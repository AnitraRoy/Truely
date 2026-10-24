// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSessionRecorder } from "../recorder";
import type { CueState, DeviationAssessment } from "@/types";

const a = (z: number, relevant: boolean, conf = 0.9): DeviationAssessment => ({
  signal: "head_orientation",
  deviationMagnitude: z,
  isRelevantDeviation: relevant,
  confidence: conf,
});
const feed = (r: ReturnType<typeof createSessionRecorder>, t: number, state: CueState, as: DeviationAssessment | null, newCueId?: string) =>
  r.observe({ now: t, state, assessment: as, newCueId });

describe("session recorder", () => {
  it("drops deviation stretches shorter than the minimum (single noisy frames)", () => {
    const r = createSessionRecorder();
    feed(r, 0, "CANDIDATE_DEVIATION", a(3, true));
    feed(r, 100, "OBSERVING", a(0.2, false));
    expect(r.close(200).segments).toEqual([]);
  });

  it("records a deviation that ends at the last deviating frame, not the engine's gap tolerance", () => {
    const r = createSessionRecorder();
    for (let t = 0; t <= 1500; t += 100) feed(r, t, "CANDIDATE_DEVIATION", a(3, true));
    feed(r, 1600, "CANDIDATE_DEVIATION", a(0.2, false));
    feed(r, 2100, "OBSERVING", a(0.2, false));
    const [seg] = r.close(3000).segments;
    expect(seg).toMatchObject({ kind: "deviation", start: 0, end: 1500, signal: "head_orientation" });
    expect(seg.eventId).toBeUndefined();
  });

  it("links the deviation that led to a cue to that cue's id", () => {
    const r = createSessionRecorder();
    for (let t = 0; t < 2500; t += 100) feed(r, t, "CANDIDATE_DEVIATION", a(4, true));
    feed(r, 2500, "CUE_VISIBLE", a(4, true), "cue-1");
    const segs = r.close(3000).segments;
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: "deviation", start: 0, end: 2500, eventId: "cue-1" });
  });

  it("records tracking gaps and paused spans, and never series points inside them", () => {
    const r = createSessionRecorder();
    feed(r, 0, "OBSERVING", a(0.1, false));
    feed(r, 1000, "TRACKING_UNAVAILABLE", a(0, false, 0.2));
    feed(r, 3000, "OBSERVING", a(0.1, false));
    feed(r, 4000, "PAUSED", null);
    feed(r, 6000, "OBSERVING", a(0.1, false));
    const { segments, series } = r.close(7000);
    expect(segments.map((s) => [s.kind, s.start, s.end])).toEqual([
      ["tracking_gap", 1000, 3000],
      ["paused", 4000, 6000],
    ]);
    expect(series.map((p) => p.t)).toEqual([0, 3000, 6000]);
  });

  it("only records trusted measurements, downsampled", () => {
    const r = createSessionRecorder({ seriesIntervalMs: 500 });
    for (let t = 0; t <= 2000; t += 100) feed(r, t, "OBSERVING", a(1, false, t === 600 ? 0.1 : 0.9));
    const { series } = r.close(2000);
    expect(series.map((p) => p.t)).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it("closes open spans at session end", () => {
    const r = createSessionRecorder();
    feed(r, 0, "TRACKING_UNAVAILABLE", null);
    expect(r.close(5000).segments).toEqual([{ kind: "tracking_gap", start: 0, end: 5000 }]);
  });
});
