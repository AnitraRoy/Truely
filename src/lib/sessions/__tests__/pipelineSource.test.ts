// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createObservationExtractor,
  createPipelineVisionSource,
  observationsToFrame,
  type PipelineLike,
} from "../pipelineSource";
import { classifyCameraError } from "../errors";
import { MOTION_SIGNAL, PITCH_SIGNAL, YAW_SIGNAL, type PipelineOptions, type VisionObservation } from "@/lib/signals/pipeline";
import type { VisionFrame } from "@/types";

const ob = (signal: string, value: number, valid = true, confidence = 0.9, timestamp = 1000): VisionObservation => ({
  timestamp, signal, value, confidence, valid,
});

describe("observationsToFrame (pipeline signals → engine signals)", () => {
  it("maps yaw → head_orientation and motion → movement_variability; drops pitch", () => {
    const f = observationsToFrame([ob(YAW_SIGNAL, 0.07), ob(PITCH_SIGNAL, 0.5), ob(MOTION_SIGNAL, 0.2)]);
    expect(f.faceDetected).toBe(true);
    expect(f.trackingConfidence).toBe(0.9);
    expect(f.signals!.map((s) => [s.signal, s.value])).toEqual([
      ["head_orientation", 0.07],
      ["movement_variability", 0.2],
    ]);
  });

  it("an invalid yaw (no face, bad lighting, small face) yields NO observations and zero confidence", () => {
    const f = observationsToFrame([ob(YAW_SIGNAL, 0, false, 0.8), ob(PITCH_SIGNAL, 0, false), ob(MOTION_SIGNAL, 0, false)]);
    expect(f).toMatchObject({ faceDetected: false, trackingConfidence: 0, signals: [] });
  });

  it("an invalid motion sample (first frame after a gap) is simply omitted", () => {
    const f = observationsToFrame([ob(YAW_SIGNAL, 0.03), ob(MOTION_SIGNAL, 0, false)]);
    expect(f.signals!.map((s) => s.signal)).toEqual(["head_orientation"]);
  });

  it("the extractor passes pipeline signals straight through", () => {
    const f = observationsToFrame([ob(YAW_SIGNAL, 0.03)]);
    expect(createObservationExtractor().extract(f)).toHaveLength(1);
    expect(createObservationExtractor().extract({ timestamp: 0, faceDetected: false, trackingConfidence: 0 })).toEqual([]);
  });
});

/** Fake SignalPipeline: scriptable start result, records calls, lets the test emit observations. */
function rig(opts: { startOk?: boolean; failCode?: Parameters<NonNullable<PipelineOptions["onError"]>>[0]; delay?: boolean } = {}) {
  const log = { starts: 0, stops: 0 };
  let captured!: PipelineOptions;
  let release: () => void = () => {};
  const video = { srcObject: null as unknown };
  const pipeline: PipelineLike = {
    async start(v) {
      log.starts++;
      if (opts.delay) await new Promise<void>((r) => (release = r));
      if (opts.startOk === false) {
        captured.onError?.(opts.failCode ?? "camera_denied", "nope");
        return false;
      }
      (v as unknown as { srcObject: unknown }).srcObject = { id: "stream" };
      return true;
    },
    stop() { log.stops++; },
    dispose() {},
  };
  const source = createPipelineVisionSource({
    createPipeline: (o) => ((captured = o), pipeline),
    createVideo: () => video as unknown as HTMLVideoElement,
  });
  return { source, log, emit: (o: VisionObservation[]) => captured.onObservations(o), fireError: (c: "camera_not_found") => captured.onError?.(c, "unplugged"), release: () => release(), video };
}

describe("pipeline → VisionSource adapter", () => {
  it("emits frames only while active, and exposes the stream for the preview", async () => {
    const r = rig();
    const frames: VisionFrame[] = [];
    r.source.onFrame((f) => frames.push(f));
    r.emit([ob(YAW_SIGNAL, 0.05)]); // not started yet → ignored
    await r.source.start();
    r.emit([ob(YAW_SIGNAL, 0.05)]);
    expect(frames).toHaveLength(1);
    expect(r.source.isActive()).toBe(true);
    expect(r.source.getStream?.()).toEqual({ id: "stream" });
    r.source.stop();
    r.emit([ob(YAW_SIGNAL, 0.05)]);
    expect(frames).toHaveLength(1);
    expect(r.log.stops).toBe(1);
    expect(r.source.getStream?.()).toBeNull();
  });

  it.each([
    ["camera_denied", "camera_denied"],
    ["camera_not_found", "no_device"],
    ["camera_in_use", "camera_busy"],
    ["model_load_failed", "vision_init"],
  ] as const)("start failure %s reaches the UI as %s", async (code, kind) => {
    const r = rig({ startOk: false, failCode: code });
    const err = await r.source.start().catch((e: unknown) => e);
    expect(classifyCameraError(err).kind).toBe(kind);
    expect(r.log.stops).toBeGreaterThanOrEqual(1); // camera released after a failed start
    expect(r.source.isActive()).toBe(false);
  });

  it("stop() during a pending start still ends released; a following start() works (StrictMode)", async () => {
    const r = rig({ delay: true });
    const first = r.source.start();
    await Promise.resolve();
    r.source.stop();
    const second = r.source.start();
    r.release(); // first start completes → queued teardown → second start runs
    await first;
    await new Promise((res) => setTimeout(res, 0));
    r.release();
    await second;
    expect(r.source.isActive()).toBe(true);
    expect(r.log.starts).toBe(2);
    expect(r.log.stops).toBeGreaterThanOrEqual(1);
  });

  it("a camera that disappears mid-session is reported once as a runtime error", async () => {
    const r = rig();
    const errors: Error[] = [];
    r.source.onError!((e) => errors.push(e));
    await r.source.start();
    r.fireError("camera_not_found");
    expect(errors).toHaveLength(1);
    expect(r.source.isActive()).toBe(false);
  });
});
