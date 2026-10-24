/**
 * Signals module.
 * Extracts observations from vision frames and coordinates aligned
 * vision/audio signal streams.
 */

import type { SignalObservation, VisionFrame } from "@/types";

export interface SignalExtractor {
  extract(frame: VisionFrame): SignalObservation[];
  reset(): void;
}

export interface SignalExtractorOptions {
  movementWindowMs?: number;
  minMovementSamples?: number;
}

const clamp01 = (n: number) =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

export function createSignalExtractor(
  options: SignalExtractorOptions = {},
): SignalExtractor {
  const windowMs = options.movementWindowMs ?? 1000;
  const minSamples = options.minMovementSamples ?? 5;
  let pose: { t: number; yaw: number; pitch: number }[] = [];

  return {
    reset() {
      pose = [];
    },

    extract(frame) {
      const confidence = clamp01(frame.trackingConfidence);

      if (!frame.faceDetected || confidence <= 0) {
        pose = [];
        return [];
      }

      const out: SignalObservation[] = [];
      const t = frame.timestamp;

      if (frame.headPose) {
        const { yaw, pitch } = frame.headPose;

        if (Number.isFinite(yaw) && Number.isFinite(pitch)) {
          out.push({
            timestamp: t,
            signal: "head_orientation",
            value: Math.hypot(yaw, pitch),
            confidence,
            valid: true,
          });

          pose.push({ t, yaw, pitch });
          pose = pose.filter((p) => p.t >= t - windowMs);

          if (
            pose.length >= minSamples &&
            pose[pose.length - 1].t - pose[0].t >= windowMs * 0.5
          ) {
            const n = pose.length;
            const my = pose.reduce((s, p) => s + p.yaw, 0) / n;
            const mp = pose.reduce((s, p) => s + p.pitch, 0) / n;

            const variance =
              pose.reduce(
                (s, p) =>
                  s + (p.yaw - my) ** 2 + (p.pitch - mp) ** 2,
                0,
              ) /
              (n - 1);

            out.push({
              timestamp: t,
              signal: "movement_variability",
              value: Math.sqrt(variance),
              confidence,
              valid: true,
            });
          }
        }
      }

      if (
        frame.gaze &&
        Number.isFinite(frame.gaze.x) &&
        Number.isFinite(frame.gaze.y)
      ) {
        out.push({
          timestamp: t,
          signal: "gaze_direction",
          value: Math.hypot(frame.gaze.x, frame.gaze.y),
          confidence,
          valid: true,
        });
      }

      return out;
    },
  };
}

export { SignalPipeline, YAW_SIGNAL, PITCH_SIGNAL, MOTION_SIGNAL } from "./pipeline";

export type {
  VisionObservation,
  PipelineStatus,
  PipelineErrorCode,
  PipelineOptions,
} from "./pipeline";

export { SignalAligner } from "./aligner";
export type { AlignedFrame, AlignedSignal } from "./aligner";

export { SignalHub } from "./hub";
export type { HubOptions, SignalSourceName } from "./hub";