// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCoachingEngine, selectCueText, type CoachingEngine } from "../index";
import { createPersonalizationEngine, type PersonalizationEngine } from "@/lib/personalization";
import type { CoachingGoal, CueState, DeviationAssessment, SignalName, SignalObservation } from "@/types";
import { CUE_LIBRARY, type CoachingConfigOverrides } from "@/config/coaching";

const SIGNAL: SignalName = "head_orientation";
const DT = 100;

function wobble(center: number, amplitude: number, i: number) {
  return center + amplitude * (0.7 * Math.sin(i * 0.9) + 0.3 * Math.sin(i * 2.3));
}
function obs(t: number, value: number, signal: SignalName = SIGNAL): SignalObservation {
  return { timestamp: t, signal, value, confidence: 0.9, valid: true };
}
function calibrated(center: number, amplitude: number): PersonalizationEngine {
  const p = createPersonalizationEngine();
  p.calibrate(SIGNAL, Array.from({ length: 300 }, (_, i) => obs(i * DT, wobble(center, amplitude, i))));
  return p;
}

interface Run {
  states: CueState[];
  cueTimes: number[];
}

/** Feed `valueAt(t)` through personalization → coaching for [from, to) in 100 ms steps. */
function run(
  p: PersonalizationEngine,
  c: CoachingEngine,
  from: number,
  to: number,
  valueAt: (t: number) => number,
  trackingAt: (t: number) => number = () => 0.9,
): Run {
  const out: Run = { states: [], cueTimes: [] };
  let seen = c.getEvents().length;
  for (let t = from; t < to; t += DT) {
    const o = obs(t, valueAt(t));
    p.updateDuringStablePeriod(o);
    const state = c.tick({ assessment: p.assess(o), trackingConfidence: trackingAt(t), now: t });
    out.states.push(state);
    const n = c.getEvents().length;
    if (n > seen) {
      out.cueTimes.push(...c.getEvents().slice(seen).map((e) => e.timestamp));
      seen = n;
    }
  }
  return out;
}

const NORMAL = (center: number) => () => center;

describe("cue state machine", () => {
  it("ignores a brief deviation (no cue for a momentary blip)", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    const r = run(p, c, 0, 20_000, (t) => (t >= 5000 && t < 6200 ? 20 : 2));
    expect(c.getEvents()).toHaveLength(0);
    expect(r.states).toContain("CANDIDATE_DEVIATION"); // it noticed, but waited
    expect(r.states).not.toContain("CUE_VISIBLE");
  });

  it("emits one timestamped cue after a sustained deviation, going OBSERVING → CANDIDATE → CUE_VISIBLE", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine({ goal: "general_awareness" });
    const r = run(p, c, 0, 2000, NORMAL(2));
    expect(new Set(r.states)).toEqual(new Set(["OBSERVING"]));

    const dev = run(p, c, 2000, 7000, () => 14);
    const events = c.getEvents();
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.timestamp).toBeGreaterThanOrEqual(2000 + 2500);
    expect(ev.timestamp).toBeLessThan(2000 + 3500);
    expect(ev.signal).toBe(SIGNAL);
    expect(ev.cueText).toBe(CUE_LIBRARY.head_orientation);
    expect(ev.deviationMagnitude!).toBeGreaterThan(2);
    expect(ev.confidence).toBeGreaterThanOrEqual(0.6);
    expect(dev.states.indexOf("CANDIDATE_DEVIATION")).toBeLessThan(dev.states.indexOf("CUE_VISIBLE"));
    expect(c.getActiveCue()?.id).toBe(ev.id);
  });

  it("auto-hides the cue, enters COOLDOWN, and does not repeat inside it", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    const r = run(p, c, 0, 25_000, () => 14); // constant deviation
    expect(r.cueTimes).toHaveLength(1);
    expect(r.states).toContain("COOLDOWN");
    expect(c.getActiveCue()).toBeNull();
    expect(c.getEvents()[0].dismissed).toBe(false); // expired on its own
  });

  it("dismissal ends the cue immediately and is recorded", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    run(p, c, 0, 3500, () => 14);
    expect(c.getActiveCue()).not.toBeNull();
    c.dismissActiveCue();
    expect(c.getActiveCue()).toBeNull();
    expect(c.getState()).toBe("COOLDOWN");
    expect(c.getEvents()[0].dismissed).toBe(true);
  });

  it("does not nag forever: caps repeats until the signal looks normal again", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    const r = run(p, c, 0, 600_000, () => 14); // 10 minutes of the same pattern
    expect(r.cueTimes).toHaveLength(2); // maxUnrecoveredCues

    // Back to normal long enough to count as recovered, then it happens again.
    run(p, c, 600_000, 700_000, NORMAL(2));
    const again = run(p, c, 700_000, 710_000, () => 14);
    expect(again.cueTimes).toHaveLength(1);
  });
});

describe("rules", () => {
  it("never cues while paused, and works again after resume", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    run(p, c, 0, 1000, NORMAL(2));
    c.pause();
    const paused = run(p, c, 1000, 10_000, () => 14);
    expect(new Set(paused.states)).toEqual(new Set(["PAUSED"]));
    expect(c.getEvents()).toHaveLength(0);

    c.resume();
    const after = run(p, c, 10_000, 15_000, () => 14);
    expect(after.cueTimes).toHaveLength(1);
    expect(after.cueTimes[0]).toBeGreaterThanOrEqual(10_000 + 2500);
  });

  it("never cues without tracking confidence, and reports TRACKING_UNAVAILABLE", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    const r = run(p, c, 0, 20_000, () => 14, () => 0.3);
    expect(c.getEvents()).toHaveLength(0);
    expect(r.states[r.states.length - 1]).toBe("TRACKING_UNAVAILABLE");
  });

  it("tolerates a single dropped frame mid-deviation", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    const r = run(p, c, 0, 5000, () => 14, (t) => (t === 1500 ? 0.1 : 0.9));
    expect(r.cueTimes).toHaveLength(1);
  });

  it("drops evidence after sustained tracking loss (no stale cue when it returns)", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    // 2 s of deviation, 3 s of lost tracking, 1 s of deviation: never 2.5 s continuous.
    const r = run(p, c, 0, 6000, () => 14, (t) => (t >= 2000 && t < 5000 ? 0.1 : 0.9));
    expect(r.cueTimes).toHaveLength(0);
  });

  it("only coaches signals relevant to the selected goal (PRD §8 rule 6)", () => {
    const gaze: DeviationAssessment = {
      signal: "gaze_direction", deviationMagnitude: 5, isRelevantDeviation: true, confidence: 0.9,
    };
    const feed = (goal: CoachingGoal) => {
      const c = createCoachingEngine({ goal });
      for (let t = 0; t < 8000; t += DT) c.tick({ assessment: gaze, trackingConfidence: 0.9, now: t });
      return c;
    };
    expect(feed("general_awareness").getEvents()).toHaveLength(0);
    expect(feed("head_movement").getEvents()).toHaveLength(0);
    const eng = feed("camera_engagement").getEvents();
    expect(eng).toHaveLength(1);
    expect(eng[0].cueText).toBe(CUE_LIBRARY.gaze_direction);
  });

  it("selects goal-appropriate wording", () => {
    expect(selectCueText("camera_engagement", "gaze_direction")).toBe(CUE_LIBRARY.gaze_direction);
    expect(selectCueText("camera_engagement", "head_orientation")).not.toBe(CUE_LIBRARY.head_orientation);
    expect(selectCueText("head_movement", "movement_variability")).toBe(CUE_LIBRARY.movement_variability);
    expect(selectCueText("general_awareness", "head_orientation")).toBe(CUE_LIBRARY.head_orientation);
  });
});

describe("personalization → coaching, end to end", () => {
  it("the SAME behavior produces different coaching decisions for two profiles (PRD §17.10)", () => {
    const testInput = (t: number) => (t < 1000 ? 8 : wobble(15, 1, t / DT)); // a held head turn

    const profileA = calibrated(10, 8); // moves a lot — 15 is within their normal range
    const profileB = calibrated(2, 1); //  very still — 15 is a big change for them
    const coachA = createCoachingEngine();
    const coachB = createCoachingEngine();

    run(profileA, coachA, 0, 15_000, testInput);
    run(profileB, coachB, 0, 15_000, testInput);

    expect(coachA.getEvents()).toHaveLength(0);
    expect(coachB.getEvents()).toHaveLength(1);
  });
});

describe("feedback adaptation (PRD §7.5)", () => {
  /** Times at which cues appear for a constant deviation, optionally answering the first cue. */
  const cueTimesWith = (feedback?: "helpful" | "not_helpful" | "too_distracting") => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    let answered = false;
    const times: number[] = [];
    let seen = 0;
    for (let t = 0; t < 120_000; t += DT) {
      const o = obs(t, 14);
      c.tick({ assessment: p.assess(o), trackingConfidence: 0.9, now: t });
      const evs = c.getEvents();
      if (evs.length > seen) { times.push(evs[evs.length - 1].timestamp); seen = evs.length; }
      if (feedback && !answered && evs.length === 1 && c.getActiveCue() === null) {
        c.recordFeedback(evs[0].id, feedback);
        answered = true;
      }
    }
    return { times, events: c.getEvents(), adaptation: c.getAdaptationState() };
  };

  it("'too distracting' lengthens the cooldown before the next cue", () => {
    const control = cueTimesWith();
    const distracted = cueTimesWith("too_distracting");
    expect(distracted.times[1]).toBeGreaterThan(control.times[1] + 15_000);
    expect(distracted.events[0].feedback).toBe("too_distracting");
    expect(distracted.adaptation.head_orientation?.tooDistracting).toBe(1);
  });

  it("'not helpful' is recorded but never makes cues more frequent", () => {
    const control = cueTimesWith();
    const notHelpful = cueTimesWith("not_helpful");
    expect(notHelpful.times[1]).toBeGreaterThanOrEqual(control.times[1]);
    expect(notHelpful.events[0].feedback).toBe("not_helpful");
  });

  it("restores learned feedback from a previous session", () => {
    const first = cueTimesWith("too_distracting");
    const p = calibrated(2, 1);
    const c = createCoachingEngine({ adaptation: first.adaptation });
    const r = run(p, c, 0, 120_000, () => 14);
    const control = cueTimesWith();
    expect(r.cueTimes[0]).toBeLessThan(5000); // first cue unaffected
    expect(r.cueTimes[1]).toBeGreaterThan(control.times[1] + 15_000); // later cooldowns longer
  });

  it("notifies subscribers when an event is created and when feedback arrives", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    const seen: Array<{ id: string; feedback?: string }> = [];
    const off = c.subscribe((e) => seen.push({ id: e.id, feedback: e.feedback }));
    run(p, c, 0, 4000, () => 14);
    c.recordFeedback(c.getEvents()[0].id, "helpful");
    off();
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1]?.feedback).toBe("helpful");
  });
});

describe("response measurement (PRD §6 Screen D)", () => {
  const cfg: CoachingConfigOverrides = {};

  it("records a measured move toward baseline — as an observation only", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine({ config: cfg });
    run(p, c, 0, 5000, () => 14);
    run(p, c, 5000, 15_000, () => 2); // behavior settles after the cue
    const ev = c.getEvents()[0];
    expect(ev.response?.windowComplete).toBe(true);
    expect(ev.response?.observedChange).toBe("closer_to_baseline");
    expect(ev.response!.postMeanDeviation!).toBeLessThan(ev.response!.preDeviation);
    expect(ev.responseWindowEnd).toBe(ev.timestamp + 8000);
  });

  it("reports 'no clear change' when the signal stays where it was", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    run(p, c, 0, 15_000, () => 14);
    expect(c.getEvents()[0].response?.observedChange).toBe("no_clear_change");
  });

  it("says 'insufficient data' when tracking was lost after the cue — never invents a result", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    run(p, c, 0, 15_000, () => 14, (t) => (t < 3000 ? 0.9 : 0.1));
    const ev = c.getEvents()[0];
    expect(ev.response?.observedChange).toBe("insufficient_data");
  });

  it("closes an open window at session end and marks it incomplete", () => {
    const p = calibrated(2, 1);
    const c = createCoachingEngine();
    run(p, c, 0, 5000, () => 14);
    const [ev] = c.endSession(5000);
    expect(ev.response?.windowComplete).toBe(false);
    expect(c.getActiveCue()).toBeNull();
  });
});
