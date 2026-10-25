// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSessionController } from "../sessionController";
import {
  PIPELINE_CONFIG_OVERRIDES,
  createObservationExtractor,
  createPipelineVisionSource,
  type PipelineLike,
} from "../pipelineSource";
import { createMemoryStorage } from "@/lib/storage";
import { wobble } from "@/lib/vision/scriptedSource";
import { MOTION_SIGNAL, PITCH_SIGNAL, YAW_SIGNAL, type PipelineOptions } from "@/lib/signals/pipeline";
import type { CoachingConfigOverrides } from "@/config/coaching";

/**
 * Headless run of the REAL chain with data shaped like Person 2's pipeline:
 *   fake SignalPipeline (unitless proxies @15 fps) → adapter → controller → engines → report data
 * Yaw proxy = nose offset ÷ face width: resting ≈ 0.02 ± 0.012, a clear head turn ≈ 0.14.
 */
function rig(config?: CoachingConfigOverrides) {
  const T0 = 5_000_000;
  const STEP = 67; // ≈ 15 fps
  let t = T0;
  let emit!: PipelineOptions["onObservations"];
  const pipeline: PipelineLike = {
    async start() { return true; },
    stop() {},
    dispose() {},
  };
  const vision = createPipelineVisionSource({
    createPipeline: (o) => ((emit = o.onObservations), pipeline),
    createVideo: () => ({ srcObject: null }) as unknown as HTMLVideoElement,
  });
  const controller = createSessionController({
    vision,
    storage: createMemoryStorage(),
    clock: () => t,
    extractor: createObservationExtractor(),
    config,
    emitIntervalMs: 0,
  });
  /** Advance virtual time, emitting one pipeline tick per step. `yaw(u)` gives the proxy at elapsed ms. */
  const run = (ms: number, yaw: (elapsed: number) => number, opts: { valid?: boolean } = {}) => {
    const end = t + ms;
    while (t < end) {
      t += STEP;
      const valid = opts.valid ?? true;
      const q = valid ? 0.9 : 0.2;
      emit([
        { timestamp: t, signal: YAW_SIGNAL, value: valid ? yaw(t - T0) : 0, confidence: q, valid },
        { timestamp: t, signal: PITCH_SIGNAL, value: 0.5, confidence: q, valid },
        { timestamp: t, signal: MOTION_SIGNAL, value: valid ? 0.15 + 0.05 * wobble(t) : 0, confidence: q, valid },
      ]);
    }
  };
  return { controller, run, at: () => t };
}

const calm = (elapsed: number) => 0.02 + 0.012 * wobble(elapsed);
const CAL_MS = 46_000;

async function sessionWithTurn(config?: CoachingConfigOverrides) {
  const r = rig(config);
  await r.controller.startCalibration();
  r.run(CAL_MS, calm);
  expect(r.controller.getSnapshot().phase).toBe("calibrated");
  await r.controller.startSession();
  r.run(8_000, calm); // quiet start
  const turnFrom = r.at();
  r.run(8_000, () => 0.14); // sustained, clear head turn (≈ 15–20°)
  r.run(20_000, calm);
  const session = (await r.controller.end())!;
  return { session, turnFrom, snapshot: r.controller.getSnapshot() };
}

describe("pipeline-shaped data → coaching decisions", () => {
  it("calibrates from real-shaped data and stores baselines in the pipeline's own units", async () => {
    const r = rig(PIPELINE_CONFIG_OVERRIDES);
    await r.controller.startCalibration();
    r.run(CAL_MS, calm);
    const snap = r.controller.getSnapshot();
    expect(snap.hasBaseline).toBe(true);
    const yaw = snap.baselines.find((b) => b.signal === "head_orientation")!;
    expect(yaw.mean).toBeCloseTo(0.02, 1);
    expect(snap.baselines.some((b) => b.signal === "movement_variability")).toBe(false); // goal is general_awareness → only needs head_orientation
  });

  it("a sustained head turn produces exactly one cue with the pipeline overrides", async () => {
    const { session, turnFrom } = await sessionWithTurn(PIPELINE_CONFIG_OVERRIDES);
    expect(session.events).toHaveLength(1);
    expect(session.events[0].signal).toBe("head_orientation");
    expect(session.events[0].timestamp).toBeGreaterThan(turnFrom);
    expect(session.events[0].response?.windowComplete).toBe(true);
    expect(session.segments!.some((s) => s.kind === "deviation" && s.eventId === session.events[0].id)).toBe(true);
  });

  it("REGRESSION GUARD: the same input with the default degree-based thresholds never cues", async () => {
    // This is the unit mismatch: minStdDev 2.0 (degrees) vs a proxy that moves ~0.1 for a big turn.
    const { session } = await sessionWithTurn(undefined);
    expect(session.events).toHaveLength(0);
  });

  it("a brief glance doesn't cue; losing the face yields a tracking gap, not a cue", async () => {
    const r = rig(PIPELINE_CONFIG_OVERRIDES);
    await r.controller.startCalibration();
    r.run(CAL_MS, calm);
    await r.controller.startSession();
    r.run(5_000, calm);
    r.run(1_000, () => 0.14); // 1-second glance
    r.run(5_000, calm);
    r.run(6_000, calm, { valid: false }); // face lost / too dark
    expect(r.controller.getSnapshot().status).toBe("tracking_unavailable");
    expect(r.controller.getSnapshot().trackingMessage).toMatch(/tracking is limited/i);
    r.run(5_000, calm);
    const s = (await r.controller.end())!;
    expect(s.events).toHaveLength(0);
    expect(s.segments!.some((x) => x.kind === "tracking_gap")).toBe(true);
  });
});
