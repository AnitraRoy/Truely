/**
 * Bridge: Person 2's `SignalPipeline` (camera + MediaPipe + head-pose proxies)
 * → the `VisionSource` the session controller consumes.
 *
 *   SignalPipeline ─ VisionObservation[] (head_yaw_proxy, head_motion, …)
 *        └─ this adapter ─ VisionFrame { faceDetected, trackingConfidence, signals[] }
 *             └─ sessionController ─ personalization ─ coaching ─ recorder
 *
 * WHY IT'S NEEDED
 *  1. The pipeline speaks its own signal names; the engines speak `SignalName`
 *     ("head_orientation", "movement_variability"). Mapping:
 *        head_yaw_proxy → head_orientation        (signed; deviation is |value − baseline|)
 *        head_motion    → movement_variability    (face-widths / second)
 *     head_pitch_proxy is NOT forwarded: it is marked experimental, and its resting value
 *     isn't centered on 0, so folding it into an "offset" would be wrong.
 *  2. UNITS. The pipeline's values are unitless face-relative proxies, but config/coaching.ts
 *     assumes degrees (`minStdDev.head_orientation = 2.0`). Used as-is, that floor is ~100×
 *     larger than a real head turn (≈0.06 in proxy units) and NO cue could ever fire.
 *     `PIPELINE_CONFIG_OVERRIDES` fixes that; pass it as `config` to the controller.
 *     The numbers are PROVISIONAL — measure real baselines (vision-test.html) and adjust.
 *  3. Concurrency. `SignalPipeline.start()` returns false if a start is already running and
 *     doesn't honor a stop() issued mid-start (a camera can be left on). start()/stop()
 *     here are serialized so React StrictMode's mount → unmount → mount is safe.
 *
 * Privacy: frames never leave the pipeline; this file only sees numbers.
 */

import type { CoachingConfigOverrides } from "@/config/coaching";
import {
  MOTION_SIGNAL,
  SignalPipeline,
  YAW_SIGNAL,
  type PipelineErrorCode,
  type PipelineOptions,
  type VisionObservation,
} from "@/lib/signals/pipeline";
import type { SignalExtractor } from "@/lib/signals";
import type { VisionSource } from "@/lib/vision/types";
import type { SignalObservation, VisionFrame } from "@/types";

/**
 * Noise floors in the pipeline's units. A floor stops a very steady person from getting a
 * near-zero std-dev (and therefore enormous z-scores from tiny wobbles).
 *   head_orientation:     ≈ 2° of head turn ≈ 0.015–0.02 face-widths of nose offset
 *   movement_variability: speeds are in face-widths/s; resting speech jitter is ~0.05
 * PROVISIONAL — validate on real calibrations and tune.
 */
export const PIPELINE_CONFIG_OVERRIDES: CoachingConfigOverrides = {
  minStdDev: { head_orientation: 0.02, movement_variability: 0.05 },
};

/** Minimal surface of SignalPipeline this adapter needs (also what tests fake). */
export interface PipelineLike {
  start(video: HTMLVideoElement): Promise<boolean>;
  stop(): void;
  dispose(): void;
}

export interface PipelineVisionSourceOptions {
  /** Pipeline frame-rate cap. Default 15 (the pipeline's own default). */
  targetFps?: number;
  /** Test seams. */
  createPipeline?: (opts: PipelineOptions) => PipelineLike;
  createVideo?: () => HTMLVideoElement;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** One pipeline tick → one VisionFrame carrying engine-named observations. */
export function observationsToFrame(obs: VisionObservation[], fallbackTimestamp = Date.now()): VisionFrame {
  const yaw = obs.find((o) => o.signal === YAW_SIGNAL);
  const motion = obs.find((o) => o.signal === MOTION_SIGNAL);
  const faceOk = Boolean(yaw?.valid) && Number.isFinite(yaw?.value);
  const confidence = faceOk ? clamp01(yaw!.confidence) : 0;
  const timestamp = yaw?.timestamp ?? motion?.timestamp ?? fallbackTimestamp;

  const signals: SignalObservation[] = [];
  if (faceOk && yaw) {
    signals.push({ timestamp, signal: "head_orientation", value: yaw.value, confidence, valid: true });
    if (motion?.valid && Number.isFinite(motion.value)) {
      signals.push({ timestamp, signal: "movement_variability", value: motion.value, confidence, valid: true });
    }
  }
  return { timestamp, faceDetected: faceOk, trackingConfidence: confidence, signals };
}

/** Extractor for frames that already carry `signals` (use with the controller's `extractor` option). */
export function createObservationExtractor(): SignalExtractor {
  return {
    extract: (frame) => (frame.signals ?? []).filter((o) => o.valid),
    reset() {},
  };
}

/** Browser-style error names, so `classifyCameraError` can give the right message. */
function toStartError(code: PipelineErrorCode | null, message: string): Error {
  const names: Partial<Record<PipelineErrorCode, string>> = {
    camera_denied: "NotAllowedError",
    camera_not_found: "NotFoundError",
    camera_in_use: "NotReadableError",
    model_load_failed: "VisionInitError",
  };
  const err = new Error(message || "The camera or tracking model could not start.");
  err.name = (code && names[code]) || "VisionInitError";
  return err;
}

export function createPipelineVisionSource(options: PipelineVisionSourceOptions = {}): VisionSource {
  const frameListeners = new Set<(f: VisionFrame) => void>();
  const errorListeners = new Set<(e: Error) => void>();
  let lastError: { code: PipelineErrorCode; message: string } | null = null;
  let starting = false;
  let active = false;
  let video: HTMLVideoElement | null = null;

  const makePipeline =
    options.createPipeline ?? ((o: PipelineOptions) => new SignalPipeline(o) as PipelineLike);

  const pipeline = makePipeline({
    targetFps: options.targetFps ?? 15,
    onObservations: (obs) => {
      if (!active) return;
      const frame = observationsToFrame(obs);
      frameListeners.forEach((l) => l(frame));
    },
    onError: (code, message) => {
      lastError = { code, message };
      // Failures during start() are returned by start(); later ones (camera unplugged) are runtime errors.
      if (!starting && active) {
        active = false;
        errorListeners.forEach((l) => l(toStartError(code, message)));
      }
    },
  });

  // start()/stop() run strictly one after another (see header note 3).
  let chain: Promise<void> = Promise.resolve();
  let inFlight = 0;
  function enqueue<T>(fn: () => Promise<T> | T): Promise<T> {
    inFlight += 1;
    const run = chain.then(fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run.finally(() => {
      inFlight -= 1;
    });
  }

  function teardown() {
    active = false;
    try {
      pipeline.stop(); // releases every MediaStream track; the model stays loaded for the next start
    } catch {
      /* stopping must never throw */
    }
    if (video) video.srcObject = null;
    video = null;
  }

  async function doStart() {
    if (active) return;
    lastError = null;
    starting = true;
    try {
      video = (options.createVideo ?? (() => document.createElement("video")))();
      const ok = await pipeline.start(video);
      if (!ok) {
        const e = lastError as { code: PipelineErrorCode; message: string } | null;
        throw toStartError(e?.code ?? null, e?.message ?? "");
      }
      active = true;
    } catch (e) {
      teardown();
      throw e;
    } finally {
      starting = false;
    }
  }

  return {
    start: () => enqueue(doStart),
    stop() {
      active = false; // no more frames from this instant
      if (inFlight === 0) teardown();
      else void enqueue(teardown); // a start is in flight: tear down as soon as it settles
    },
    isActive: () => active,
    getStream: () => (video?.srcObject as MediaStream | null) ?? null,
    onFrame(l) {
      frameListeners.add(l);
      return () => frameListeners.delete(l);
    },
    onError(l) {
      errorListeners.add(l);
      return () => errorListeners.delete(l);
    },
  };
}
