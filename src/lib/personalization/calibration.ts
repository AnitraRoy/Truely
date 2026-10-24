/**
 * Calibration collector — gathers observations during the ~30–60 s calibration
 * step and reports progress for the Calibration screen (PRD §6 Screen B).
 *
 * Usage:
 *   const c = createCalibrationCollector("head_orientation");
 *   // each frame:  c.add(observation);  progressBar = c.getProgress().fraction;
 *   // when ready:  engine.calibrate("head_orientation", c.getObservations());
 */

import {
  resolveCoachingConfig,
  type CoachingConfigOverrides,
} from "@/config/coaching";
import type { SignalName, SignalObservation } from "@/types";

export interface CalibrationProgress {
  validCount: number;
  requiredCount: number;
  elapsedMs: number;
  targetDurationMs: number;
  /** 0..1 — limited by whichever of "enough time" / "enough samples" is behind. */
  fraction: number;
  /** True once both the minimum samples AND the target duration are reached. */
  ready: boolean;
}

export interface CalibrationCollector {
  add(obs: SignalObservation): void;
  getProgress(): CalibrationProgress;
  /** All observations seen for this signal (invalid ones are filtered at calibrate time). */
  getObservations(): SignalObservation[];
  reset(): void;
}

export function createCalibrationCollector(
  signal: SignalName,
  config?: CoachingConfigOverrides,
): CalibrationCollector {
  const cfg = resolveCoachingConfig(config);
  let observations: SignalObservation[] = [];
  let validCount = 0;
  let firstTs: number | null = null;
  let lastTs = 0;

  return {
    add(obs) {
      if (obs.signal !== signal) return;
      observations.push(obs);
      if (firstTs === null) firstTs = obs.timestamp;
      lastTs = Math.max(lastTs, obs.timestamp);
      if (obs.valid && Number.isFinite(obs.value) && obs.confidence >= cfg.minTrackingConfidence) {
        validCount += 1;
      }
    },

    getProgress() {
      const elapsedMs = firstTs === null ? 0 : lastTs - firstTs;
      const sampleFraction = Math.min(1, validCount / cfg.minCalibrationSamples);
      const timeFraction = Math.min(1, elapsedMs / cfg.calibrationDurationMs);
      return {
        validCount,
        requiredCount: cfg.minCalibrationSamples,
        elapsedMs,
        targetDurationMs: cfg.calibrationDurationMs,
        fraction: Math.min(sampleFraction, timeFraction),
        ready: sampleFraction >= 1 && timeFraction >= 1,
      };
    },

    getObservations() {
      return observations;
    },

    reset() {
      observations = [];
      validCount = 0;
      firstTs = null;
      lastTs = 0;
    },
  };
}
