// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildEventDetail, buildInsights, buildSummary, buildTimeline, compareSessions, toSessionSummary } from "../index";
import type { CoachingEvent, Session } from "@/types";

const T0 = 1_000_000;
const cue = (over: Partial<CoachingEvent> = {}): CoachingEvent => ({
  id: "c1", timestamp: T0 + 30_000, signal: "head_orientation", deviationMagnitude: 4.2, confidence: 0.9,
  cueText: "Try turning back toward the camera when it feels natural.", responseWindowEnd: T0 + 38_000, dismissed: false,
  response: { preDeviation: 4.2, postMeanDeviation: 1.1, postSampleCount: 70, windowComplete: true, observedChange: "closer_to_baseline" },
  ...over,
});
const base = (over: Partial<Session> = {}): Session => ({
  id: "s1", startedAt: T0, endedAt: T0 + 90_000, goal: "camera_engagement", status: "ended",
  eventCount: 1, cueCount: 1, events: [cue()],
  segments: [{ kind: "deviation", start: T0 + 26_000, end: T0 + 30_000, signal: "head_orientation", eventId: "c1" }],
  series: [
    { t: T0 + 25_000, signal: "head_orientation", z: 3, confidence: 0.9 },
    { t: T0 + 29_500, signal: "head_orientation", z: 4, confidence: 0.9 },
    { t: T0 + 33_000, signal: "head_orientation", z: 1, confidence: 0.9 },
    { t: T0 + 60_000, signal: "head_orientation", z: 0.5, confidence: 0.9 },
  ],
  ...over,
});

describe("summary", () => {
  it("counts only what was recorded; no score field exists", () => {
    const s = buildSummary(base({ events: [cue({ dismissed: true, feedback: "helpful" })], mutedCueIds: [] }));
    expect(s).toMatchObject({ durationMs: 90_000, cueCount: 1, cuesShown: 1, cuesDismissed: 1, feedbackGiven: 1, deviationCount: 1 });
    expect(s.observedChanges.closer_to_baseline).toBe(1);
    expect(Object.keys(s)).not.toContain("score");
  });
  it("does not count muted cues as shown", () => {
    expect(buildSummary(base({ mutedCueIds: ["c1"] })).cuesShown).toBe(0);
  });
  it("derives list summaries", () => {
    expect(toSessionSummary(base())).toEqual({ id: "s1", startedAt: T0, durationMs: 90_000, goal: "camera_engagement", eventCount: 1, cueCount: 1 });
  });
});

describe("timeline", () => {
  it("uses real offsets for deviations, cues and the response window", () => {
    const { items, durationMs } = buildTimeline(base());
    expect(durationMs).toBe(90_000);
    expect(items.map((i) => [i.kind, i.startMs, i.endMs])).toEqual([
      ["deviation", 26_000, 30_000],
      ["cue", 30_000, 30_000],
      ["response_window", 30_000, 38_000],
    ]);
  });
  it("includes tracking gaps and pauses", () => {
    const t = buildTimeline(base({ segments: [{ kind: "tracking_gap", start: T0 + 5_000, end: T0 + 9_000 }, { kind: "paused", start: T0 + 10_000, end: T0 + 12_000 }], events: [] }));
    expect(t.items.map((i) => i.label)).toEqual(["Tracking limited", "Coaching paused"]);
  });
});

describe("event detail", () => {
  it("explains what, why and afterwards as observation — never causation", () => {
    const d = buildEventDetail(base(), "c1")!;
    expect(d.observation).toMatch(/4\.2 standard deviations.*for about 4 seconds/);
    expect(d.reason).toMatch(/tracking confidence was 90%/);
    expect(d.afterwards).toMatch(/closer to your baseline/);
    expect(d.afterwards).toMatch(/doesn't show that the cue caused/);
    expect(d.before.map((p) => p.z)).toEqual([3, 4]);
    expect(d.after.map((p) => p.z)).toEqual([1]);
  });
  it("says so when there is no usable response data", () => {
    const e = cue({ response: { preDeviation: 4, postSampleCount: 2, windowComplete: false, observedChange: "insufficient_data" } });
    expect(buildEventDetail(base({ events: [e] }), "c1")!.afterwards).toMatch(/session ended before enough/);
    expect(buildEventDetail(base({ events: [cue({ response: undefined })] }), "c1")!.afterwards).toMatch(/No response measurement/);
  });
  it("returns null for unknown events", () => expect(buildEventDetail(base(), "nope")).toBeNull());
});

describe("insights", () => {
  it("states only what the data supports, max 3", () => {
    const i = buildInsights(base());
    expect(i.length).toBeGreaterThanOrEqual(2);
    expect(i.length).toBeLessThanOrEqual(3);
    expect(i.join(" ")).toMatch(/1 stretch/);
    expect(i.join(" ")).toMatch(/closer to your baseline/);
    expect(i.join(" ")).not.toMatch(/confident|nervous|distracted|success/i);
  });
  it("returns nothing for an empty session", () => {
    expect(buildInsights(base({ events: [], segments: [], series: [], eventCount: 0, cueCount: 0 }))).toEqual([]);
  });
  it("leads with a tracking-quality caveat when tracking was poor", () => {
    const s = base({ segments: [{ kind: "tracking_gap", start: T0, end: T0 + 20_000 }], events: [], eventCount: 0, cueCount: 0 });
    expect(buildInsights(s)[0]).toMatch(/Tracking was limited for about 22%/);
  });
  it("doesn't claim improvement when the signal didn't move closer", () => {
    const e = cue({ response: { preDeviation: 4, postMeanDeviation: 4.2, postSampleCount: 70, windowComplete: true, observedChange: "no_clear_change" } });
    expect(buildInsights(base({ events: [e] })).join(" ")).toMatch(/didn't move closer/);
  });
});

describe("compareSessions", () => {
  it("compares rates for same-goal, ≥1 min sessions; refuses otherwise", () => {
    const a = base({ id: "a", startedAt: T0, endedAt: T0 + 120_000, eventCount: 4, cueCount: 2 });
    const b = base({ id: "b", startedAt: T0 + 1e6, endedAt: T0 + 1e6 + 120_000, eventCount: 2, cueCount: 1 });
    const c = compareSessions(b, a);
    expect(c.comparable).toBe(true);
    expect(c.earlier!.deviationsPerMinute).toBe(2);
    expect(c.later!.deviationsPerMinute).toBe(1);
    expect(compareSessions(a, base({ id: "x", goal: "head_movement", startedAt: T0 + 5e6 })).comparable).toBe(false);
  });
});
