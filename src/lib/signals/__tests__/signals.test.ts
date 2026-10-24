// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSignalExtractor } from "../index";
import type { VisionFrame } from "@/types";

const frame = (t: number, o: Partial<VisionFrame> = {}): VisionFrame => ({
  timestamp: t,
  faceDetected: true,
  trackingConfidence: 0.9,
  headPose: { yaw: 3, pitch: 4, roll: 0 },
  ...o,
});

describe("signal extractor", () => {
  it("head_orientation is the angular offset hypot(yaw, pitch)", () => {
    const [o] = createSignalExtractor().extract(frame(0));
    expect(o.signal).toBe("head_orientation");
    expect(o.value).toBeCloseTo(5);
    expect(o.valid).toBe(true);
  });

  it("emits nothing (never invented values) when the face is lost or confidence is 0", () => {
    const x = createSignalExtractor();
    expect(x.extract(frame(0, { faceDetected: false, headPose: undefined }))).toEqual([]);
    expect(x.extract(frame(100, { trackingConfidence: 0 }))).toEqual([]);
  });

  it("movement_variability is ~0 for a still head and larger for a moving one", () => {
    const still = createSignalExtractor();
    let last = [] as ReturnType<typeof still.extract>;
    for (let t = 0; t <= 1500; t += 100) last = still.extract(frame(t));
    expect(last.find((o) => o.signal === "movement_variability")!.value).toBeCloseTo(0);

    const moving = createSignalExtractor();
    for (let t = 0; t <= 1500; t += 100) {
      last = moving.extract(frame(t, { headPose: { yaw: (t / 100) % 2 === 0 ? 10 : -10, pitch: 0, roll: 0 } }));
    }
    expect(last.find((o) => o.signal === "movement_variability")!.value).toBeGreaterThan(5);
  });

  it("does not compute movement across a tracking gap", () => {
    const x = createSignalExtractor();
    for (let t = 0; t <= 1000; t += 100) x.extract(frame(t));
    x.extract(frame(1100, { faceDetected: false, headPose: undefined }));
    const after = x.extract(frame(1200));
    expect(after.find((o) => o.signal === "movement_variability")).toBeUndefined();
  });

  it("only reports gaze when vision supplies it", () => {
    const x = createSignalExtractor();
    expect(x.extract(frame(0)).some((o) => o.signal === "gaze_direction")).toBe(false);
    const g = x.extract(frame(100, { gaze: { x: 0.3, y: 0.4 } })).find((o) => o.signal === "gaze_direction")!;
    expect(g.value).toBeCloseTo(0.5);
  });
});
