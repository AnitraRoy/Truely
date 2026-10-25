// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSessionController, type SessionController, type SessionSnapshot } from "../sessionController";
import { createMemoryStorage } from "@/lib/storage";
import { createScriptedVisionSource, wobble, type ScriptedSample } from "@/lib/vision/scriptedSource";
import { buildReport, buildEventDetail } from "@/lib/reports";
import { recordFeedbackForSavedSession } from "../feedback";
import type { VisionSource } from "@/lib/vision/types";

const START = 1_000_000;
const CAL_MS = 46_000; // calibration needs 45 s + enough samples at 10 Hz
const normal = (t: number): ScriptedSample => ({ yaw: 8 + 2 * wobble(t) });

function setup(opts: { consent?: boolean; scenario?: (t: number) => ScriptedSample } = {}) {
  let scenario = opts.scenario ?? normal;
  const vision = createScriptedVisionSource({ scenario: (t) => scenario(t), startAt: START });
  const storage = createMemoryStorage();
  const controller = createSessionController({
    vision,
    storage,
    goal: "general_awareness",
    clock: () => vision.now(),
    emitIntervalMs: 0,
  });
  return {
    vision, storage, controller,
    setScenario: (s: (t: number) => ScriptedSample) => (scenario = s),
    /** virtual time since the live session started */
    async calibrate() {
      await controller.startCalibration();
      vision.pump(CAL_MS);
    },
  };
}

/** After calibration (t = CAL_MS): normal for 10 s, then `dev` seconds of a 22° offset, then normal. */
const withDeviation = (devSeconds: number) => (t: number): ScriptedSample => {
  const u = t - CAL_MS;
  return u >= 10_000 && u < 10_000 + devSeconds * 1000 ? { yaw: 22 + wobble(t) } : normal(t);
};

describe("calibration", () => {
  it("collects a baseline from the camera and reports progress", async () => {
    const { controller, vision } = setup();
    await controller.startCalibration();
    vision.pump(10_000);
    const mid = controller.getSnapshot();
    expect(mid.phase).toBe("calibrating");
    expect(mid.status).toBe("calibrating");
    expect(mid.calibration!.fraction).toBeGreaterThan(0.1);
    expect(mid.calibration!.fraction).toBeLessThan(1);
    vision.pump(CAL_MS);
    const done = controller.getSnapshot();
    expect(done.phase).toBe("calibrated");
    expect(done.hasBaseline).toBe(true);
    expect(done.baselines.find((b) => b.signal === "head_orientation")!.mean).toBeCloseTo(8, 0);
  });

  it("fails clearly (no baseline) when the face is never reliably tracked", async () => {
    const { controller, vision } = setup({ scenario: () => ({ yaw: 0, faceDetected: false }) });
    await controller.startCalibration();
    vision.pump(CAL_MS);
    expect(controller.getSnapshot().trackingMessage).toMatch(/tracking is limited/i);
    expect(controller.finishCalibration()).toBe(false);
    const s = controller.getSnapshot();
    expect(s.error?.kind).toBe("calibration");
    expect(s.hasBaseline).toBe(false);
    expect(s.phase).toBe("idle");
  });

  it("refuses to start a session without a baseline", async () => {
    const { controller } = setup();
    expect(await controller.startSession()).toBe(false);
    expect(controller.getSnapshot().error?.kind).toBe("no_baseline");
  });
});

describe("camera errors", () => {
  it("maps a permission denial to a retryable, readable error", async () => {
    const denied: VisionSource = {
      async start() { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); },
      stop() {}, isActive: () => false, onFrame: () => () => {},
    };
    const c = createSessionController({ vision: denied });
    expect(await c.startCalibration()).toBe(false);
    expect(c.getSnapshot().error?.kind).toBe("camera_denied");
    expect(c.getSnapshot().cameraActive).toBe(false);
    c.clearError();
    expect(c.getSnapshot().error).toBeNull();
  });

  it("maps a missing device", async () => {
    const none: VisionSource = {
      async start() { throw Object.assign(new Error("x"), { name: "NotFoundError" }); },
      stop() {}, isActive: () => false, onFrame: () => () => {},
    };
    const c = createSessionController({ vision: none });
    await c.startCamera();
    expect(c.getSnapshot().error?.kind).toBe("no_device");
  });
});

describe("live coaching → report", () => {
  it("a sustained deviation yields one cue; the camera is released; the report reflects real events", async () => {
    const t = setup({ scenario: withDeviation(8) });
    const { controller, vision } = t;
    await controller.init();
    await controller.setSaveConsent(true);
    await t.calibrate();
    expect(await controller.startSession()).toBe(true);

    const seen: SessionSnapshot[] = [];
    controller.subscribe(() => seen.push(controller.getSnapshot()));
    vision.pump(10_000); // normal
    expect(seen.every((s) => s.activeCue === null)).toBe(true);
    expect(controller.getSnapshot().status).toBe("observing");

    vision.pump(8_000); // deviation
    const cueSnap = seen.find((s) => s.activeCue);
    expect(cueSnap).toBeDefined();
    expect(cueSnap!.cueState).toBe("CUE_VISIBLE");
    expect(cueSnap!.activeCue!.cueText.length).toBeGreaterThan(0);

    vision.pump(25_000); // recover + response window closes
    const session = (await controller.end())!;

    expect(vision.isActive()).toBe(false); // camera released
    expect(controller.getSnapshot().phase).toBe("ended");
    expect(session.status).toBe("ended");
    expect(session.events).toHaveLength(1);
    expect(session.cueCount).toBe(1);
    expect(session.eventCount).toBe(1);
    expect(session.segments!.find((s) => s.kind === "deviation")!.eventId).toBe(session.events[0].id);
    expect(session.series!.length).toBeGreaterThan(20);
    expect(session.events[0].response?.windowComplete).toBe(true);
    expect(session.events[0].response?.observedChange).toBe("closer_to_baseline");

    // Report is built from the recorded data only.
    const report = buildReport(session);
    expect(report.summary.cueCount).toBe(1);
    expect(report.timeline.items.some((i) => i.kind === "cue")).toBe(true);
    const detail = buildEventDetail(session, session.events[0].id)!;
    expect(detail.before.length).toBeGreaterThan(0);
    expect(detail.after.length).toBeGreaterThan(0);
    expect(detail.afterwards).toMatch(/doesn't show that the cue caused/);

    // Persisted (consented)
    expect((await t.storage.listSessions()).map((s) => s.id)).toEqual([session.id]);
    expect((await t.storage.loadBaselines()).length).toBeGreaterThan(0);
  });

  it("a brief blip does not produce a cue", async () => {
    const t = setup({ scenario: withDeviation(1) });
    await t.calibrate();
    await t.controller.startSession();
    t.vision.pump(20_000);
    const s = (await t.controller.end())!;
    expect(s.events).toHaveLength(0);
  });

  it("tracking loss produces a tracking-limited status and a gap, never a cue", async () => {
    const lost = (t: number): ScriptedSample => {
      const u = t - CAL_MS;
      return u >= 5_000 && u < 12_000 ? { yaw: 30, faceDetected: false } : normal(t);
    };
    const t = setup({ scenario: lost });
    await t.calibrate();
    await t.controller.startSession();
    t.vision.pump(8_000);
    expect(t.controller.getSnapshot().status).toBe("tracking_unavailable");
    expect(t.controller.getSnapshot().trackingMessage).toMatch(/tracking is limited/i);
    t.vision.pump(10_000);
    const s = (await t.controller.end())!;
    expect(s.events).toHaveLength(0);
    expect(s.segments!.some((x) => x.kind === "tracking_gap")).toBe(true);
  });

  it("pause stops coaching decisions; resume restores them", async () => {
    const t = setup({ scenario: withDeviation(60) });
    await t.calibrate();
    await t.controller.startSession();
    t.vision.pump(5_000);
    t.controller.pause();
    expect(t.controller.getSnapshot().status).toBe("paused");
    t.vision.pump(20_000); // deviation starts at +10 s, but we are paused
    expect(t.controller.getSnapshot().activeCue).toBeNull();
    t.controller.resume();
    t.vision.pump(6_000);
    const s = (await t.controller.end())!;
    expect(s.events).toHaveLength(1);
    expect(s.events[0].timestamp).toBeGreaterThan(START + CAL_MS + 25_000); // only after resume
    expect(s.segments!.some((x) => x.kind === "paused")).toBe(true);
  });

  it("muted notifications hide the cue and are recorded as not shown", async () => {
    const t = setup({ scenario: withDeviation(8) });
    await t.calibrate();
    await t.controller.startSession();
    t.controller.setCuesMuted(true);
    const visible: boolean[] = [];
    t.controller.subscribe(() => visible.push(t.controller.getSnapshot().activeCue !== null));
    t.vision.pump(25_000);
    const s = (await t.controller.end())!;
    expect(visible.some(Boolean)).toBe(false);
    expect(s.events).toHaveLength(1);
    expect(s.mutedCueIds).toEqual([s.events[0].id]);
    expect(buildReport(s).summary.cuesShown).toBe(0);
  });

  it("dismissing a cue is recorded", async () => {
    const t = setup({ scenario: withDeviation(8) });
    await t.calibrate();
    await t.controller.startSession();
    let dismissed = false;
    t.controller.subscribe(() => {
      if (!dismissed && t.controller.getSnapshot().activeCue) {
        dismissed = true;
        t.controller.dismissCue();
      }
    });
    t.vision.pump(25_000);
    const s = (await t.controller.end())!;
    expect(s.events[0].dismissed).toBe(true);
    expect(buildReport(s).summary.cuesDismissed).toBe(1);
  });
});

describe("privacy & data controls", () => {
  it("writes NOTHING to storage without consent", async () => {
    const t = setup({ scenario: withDeviation(8) });
    await t.calibrate();
    await t.controller.startSession();
    t.vision.pump(25_000);
    await t.controller.end();
    expect(await t.storage.listSessions()).toEqual([]);
    expect(await t.storage.loadBaselines()).toEqual([]);
  });

  it("restores baselines + adaptation on init, and deleteAllData / resetBaseline wipe them", async () => {
    const t = setup({ scenario: withDeviation(8) });
    await t.controller.setSaveConsent(true);
    await t.calibrate();
    await t.controller.startSession();
    t.vision.pump(25_000);
    const s = (await t.controller.end())!;
    await t.controller.submitFeedback(s.events[0].id, "too_distracting");

    const fresh = createSessionController({ vision: t.vision, storage: t.storage, clock: () => t.vision.now() });
    await fresh.init();
    expect(fresh.getSnapshot().hasBaseline).toBe(true);
    expect(fresh.getSnapshot().saveConsent).toBe(true);
    expect((await t.storage.loadAdaptation()).head_orientation?.tooDistracting).toBe(1);

    await fresh.resetBaseline();
    expect(fresh.getSnapshot().hasBaseline).toBe(false);
    expect(await t.storage.loadBaselines()).toEqual([]);
    expect(await t.storage.listSessions()).toHaveLength(1); // history untouched

    await fresh.deleteAllData();
    expect(await t.storage.listSessions()).toEqual([]);
    expect(fresh.getSnapshot().saveConsent).toBe(false);
  });

  it("feedback after the session is stored on the event; saved-session path also works", async () => {
    const t = setup({ scenario: withDeviation(8) });
    await t.controller.setSaveConsent(true);
    await t.calibrate();
    await t.controller.startSession();
    t.vision.pump(25_000);
    const s = (await t.controller.end())!;
    const id = s.events[0].id;

    await t.controller.submitFeedback(id, "helpful");
    expect((await t.storage.getSession(s.id))!.events[0].feedback).toBe("helpful");

    const updated = await recordFeedbackForSavedSession(t.storage, s.id, id, "not_helpful");
    expect(updated!.events[0].feedback).toBe("not_helpful");
    // Changing an answer undoes the old count and applies the new one.
    const counts = (await t.storage.loadAdaptation()).head_orientation!;
    expect(counts.helpful).toBe(0);
    expect(counts.notHelpful).toBe(1);
  });

  it("recalibrate clears the old baseline and starts collecting again", async () => {
    const t = setup();
    await t.calibrate();
    expect(t.controller.getSnapshot().hasBaseline).toBe(true);
    await t.controller.recalibrate();
    expect(t.controller.getSnapshot().phase).toBe("calibrating");
    expect(t.controller.getSnapshot().hasBaseline).toBe(false);
  });

  it("goal can't change mid-session", async () => {
    const t = setup();
    await t.calibrate();
    await t.controller.startSession();
    t.controller.setGoal("head_movement");
    expect(t.controller.getSnapshot().goal).toBe("general_awareness");
  });
});

// keep TS happy about unused import in some configs
export type _ = SessionController;

describe("additional learning switch", () => {
  const settled = (t: number): ScriptedSample => (t - CAL_MS > 0 ? { yaw: 9.5 + wobble(t) } : normal(t));

  async function runLiveSession(learning: boolean) {
    const t = setup({ scenario: settled });
    await t.calibrate();
    t.controller.setLearning(learning);
    const before = t.controller.getSnapshot().baselines.find((b) => b.signal === "head_orientation")!;
    await t.controller.startSession();
    t.vision.pump(60_000);
    await t.controller.end();
    const after = t.controller.getSnapshot().baselines.find((b) => b.signal === "head_orientation")!;
    return { t, before, after };
  }

  it("keeps drifting the baseline while learning is on", async () => {
    const { before, after } = await runLiveSession(true);
    expect(after.mean).not.toBe(before.mean);
  });

  it("leaves the baseline exactly as learned while learning is off", async () => {
    const { t, before, after } = await runLiveSession(false);
    expect(t.controller.getSnapshot().learningEnabled).toBe(false);
    expect(after).toEqual(before);
  });

  it("keeps cue feedback but does not change cue timing while learning is off", async () => {
    const t = setup({ consent: true, scenario: withDeviation(5) });
    await t.controller.setSaveConsent(true);
    await t.calibrate();
    t.controller.setLearning(false);
    await t.controller.startSession();
    t.vision.pump(30_000);
    const s = (await t.controller.end())!;
    expect(s.events.length).toBeGreaterThan(0);
    await t.controller.submitFeedback(s.events[0].id, "too_distracting");
    expect(t.controller.getSnapshot().session!.events[0].feedback).toBe("too_distracting");
    expect(await t.storage.loadAdaptation()).toEqual({});
  });
});
