/**
 * signals module (PRD §9) — turns raw VisionFrames into scalar SignalObservations.
 * Reference implementation owned by Integration; Person 2 may swap in their own
 * as long as it keeps the `SignalExtractor` shape and the units documented here.
 *
 * Units (these are what config/coaching.ts `minStdDev` assumes):
 *  - head_orientation:     degrees, hypot(yaw, pitch) = angular offset from facing the camera
 *  - movement_variability: degrees, std-dev of head pose over a ~1 s window
 *  - gaze_direction:       normalized offset hypot(x, y) from screen centre (0,0); only if vision supplies gaze
 *
 * Frames without a trusted face produce NO observations (never invented values).
 * The engine is still ticked with `assessment: null` so tracking loss is detected.
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

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function createSignalExtractor(options: SignalExtractorOptions = {}): SignalExtractor {
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
        pose = []; // don't compute movement across a tracking gap
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
          if (pose.length >= minSamples && pose[pose.length - 1].t - pose[0].t >= windowMs * 0.5) {
            const n = pose.length;
            const my = pose.reduce((s, p) => s + p.yaw, 0) / n;
            const mp = pose.reduce((s, p) => s + p.pitch, 0) / n;
            const v =
              pose.reduce((s, p) => s + (p.yaw - my) ** 2 + (p.pitch - mp) ** 2, 0) / (n - 1);
            out.push({
              timestamp: t,
              signal: "movement_variability",
              value: Math.sqrt(v),
              confidence,
              valid: true,
            });
          }
        }
      }

      if (frame.gaze && Number.isFinite(frame.gaze.x) && Number.isFinite(frame.gaze.y)) {
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
