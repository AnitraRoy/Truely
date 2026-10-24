/**
 * personalization module (PRD §7, §9) — THE CORE DIFFERENTIATOR.
 * Owner: Personalization team.
 *
 * Responsibilities:
 *  - Create/load per-signal baselines from calibration observations.
 *  - Estimate baseline variability.
 *  - Compare live observations against the personal baseline (z-score).
 *  - Smooth noisy measurements before comparing.
 *  - Update baselines conservatively (pause during deviations — PRD §7.2).
 *  - Manage recalibration / reset.
 *
 * No ML model. Transparent math: mean, variance, z-score, EMA. Runs locally.
 *
 * Assumption about input: each SignalObservation.value is a single scalar per
 * signal (e.g. angular offset from facing the camera). We compare with |z|, so
 * deviation in either direction counts.
 */

import {
  resolveCoachingConfig,
  type CoachingConfig,
  type CoachingConfigOverrides,
} from "@/config/coaching";
import type {
  BehavioralBaseline,
  DeviationAssessment,
  SignalName,
  SignalObservation,
} from "@/types";

export { createCalibrationCollector } from "./calibration";
export type { CalibrationCollector, CalibrationProgress } from "./calibration";

/** Thrown when calibration did not collect enough reliable measurements. */
export class CalibrationError extends Error {
  readonly signal: SignalName;
  readonly validCount: number;
  readonly requiredCount: number;
  constructor(signal: SignalName, validCount: number, requiredCount: number) {
    super(
      `Not enough reliable ${signal} measurements to build a baseline ` +
        `(${validCount}/${requiredCount}). Check lighting and camera position, then try again.`,
    );
    this.name = "CalibrationError";
    this.signal = signal;
    this.validCount = validCount;
    this.requiredCount = requiredCount;
  }
}

export interface PersonalizationEngine {
  /** Build (and store) a baseline from a batch of calibration observations. Throws CalibrationError. */
  calibrate(signal: SignalName, obs: SignalObservation[]): BehavioralBaseline;
  /** Load a previously stored baseline. */
  loadBaseline(baseline: BehavioralBaseline): void;
  /** Compare one observation to the baseline → deviation assessment (smoothed). */
  assess(obs: SignalObservation): DeviationAssessment;
  /** Slowly nudge the baseline during stable periods only. */
  updateDuringStablePeriod(obs: SignalObservation): void;
  getBaseline(signal: SignalName): BehavioralBaseline | null;
  /** Every stored baseline — what the storage layer should persist. */
  getBaselines(): BehavioralBaseline[];
  /** Forget one baseline (or all, if omitted) — "reset baseline" / recalibrate. */
  clearBaseline(signal?: SignalName): void;
}

export interface PersonalizationOptions {
  config?: CoachingConfigOverrides;
}

/** Gap beyond which the smoother restarts instead of blending stale data (ms). */
const SMOOTHER_RESET_GAP_MS = 2000;
/** Largest time step the baseline updater will credit for one observation (ms). */
const MAX_UPDATE_STEP_MS = 1000;

export function isUsableObservation(
  obs: SignalObservation,
  config: Pick<CoachingConfig, "minTrackingConfidence">,
): boolean {
  return (
    obs.valid &&
    Number.isFinite(obs.value) &&
    Number.isFinite(obs.timestamp) &&
    obs.confidence >= config.minTrackingConfidence
  );
}

export function createPersonalizationEngine(
  options: PersonalizationOptions = {},
): PersonalizationEngine {
  const cfg = resolveCoachingConfig(options.config);

  const baselines = new Map<SignalName, BehavioralBaseline>();
  const smoothers = new Map<SignalName, { value: number; timestamp: number }>();
  /** Last time each signal looked "unstable" — baseline updates are frozen after it. */
  const lastUnstableAt = new Map<SignalName, number>();

  /** z-score of a value against a baseline, using a floored std-dev. */
  function zScore(b: BehavioralBaseline, value: number): number {
    const std = Math.max(Math.sqrt(b.variance), cfg.minStdDev[b.signal]);
    return Math.abs(value - b.mean) / std;
  }

  function smooth(obs: SignalObservation): number {
    const prev = smoothers.get(obs.signal);
    if (!prev || obs.timestamp - prev.timestamp > SMOOTHER_RESET_GAP_MS || obs.timestamp < prev.timestamp) {
      smoothers.set(obs.signal, { value: obs.value, timestamp: obs.timestamp });
      return obs.value;
    }
    const dt = obs.timestamp - prev.timestamp;
    const alpha = 1 - Math.exp(-dt / cfg.smoothingTimeConstantMs);
    const value = prev.value + alpha * (obs.value - prev.value);
    smoothers.set(obs.signal, { value, timestamp: obs.timestamp });
    return value;
  }

  return {
    calibrate(signal, obs) {
      const usable = obs.filter((o) => o.signal === signal && isUsableObservation(o, cfg));
      if (usable.length < cfg.minCalibrationSamples) {
        throw new CalibrationError(signal, usable.length, cfg.minCalibrationSamples);
      }

      // Welford's online algorithm — numerically stable mean/variance.
      let n = 0;
      let mean = 0;
      let m2 = 0;
      let firstTs = Infinity;
      let lastTs = -Infinity;
      for (const o of usable) {
        n += 1;
        const delta = o.value - mean;
        mean += delta / n;
        m2 += delta * (o.value - mean);
        firstTs = Math.min(firstTs, o.timestamp);
        lastTs = Math.max(lastTs, o.timestamp);
      }

      const baseline: BehavioralBaseline = {
        signal,
        sampleCount: n,
        mean,
        variance: n > 1 ? m2 / (n - 1) : 0,
        calibrationDurationMs: lastTs - firstTs,
        updatedAt: lastTs,
      };
      baselines.set(signal, baseline);
      smoothers.delete(signal);
      lastUnstableAt.delete(signal);
      return { ...baseline };
    },

    loadBaseline(baseline) {
      if (
        !Number.isFinite(baseline.mean) ||
        !Number.isFinite(baseline.variance) ||
        baseline.variance < 0
      ) {
        throw new TypeError(`Invalid baseline for ${baseline.signal}`);
      }
      baselines.set(baseline.signal, { ...baseline });
      smoothers.delete(baseline.signal);
      lastUnstableAt.delete(baseline.signal);
    },

    assess(obs) {
      const baseline = baselines.get(obs.signal);
      const confidence = obs.valid && Number.isFinite(obs.value) ? obs.confidence : 0;

      // No baseline, or an observation we can't trust → never a deviation.
      if (!baseline || !isUsableObservation(obs, cfg)) {
        return { signal: obs.signal, deviationMagnitude: 0, isRelevantDeviation: false, confidence };
      }

      const z = zScore(baseline, smooth(obs));
      if (z >= cfg.baselineStableZ) lastUnstableAt.set(obs.signal, obs.timestamp);

      return {
        signal: obs.signal,
        deviationMagnitude: z,
        isRelevantDeviation: z >= cfg.deviationZThreshold,
        confidence,
      };
    },

    updateDuringStablePeriod(obs) {
      const baseline = baselines.get(obs.signal);
      if (!baseline || !isUsableObservation(obs, cfg)) return;

      // Suspected deviation → freeze, and stay frozen for a while (PRD §7.2).
      if (zScore(baseline, obs.value) >= cfg.baselineStableZ) {
        lastUnstableAt.set(obs.signal, obs.timestamp);
        return;
      }
      const unstableAt = lastUnstableAt.get(obs.signal);
      if (unstableAt !== undefined && obs.timestamp - unstableAt < cfg.baselineUpdateHoldMs) return;

      const dt = Math.min(obs.timestamp - baseline.updatedAt, MAX_UPDATE_STEP_MS);
      if (dt <= 0) return;

      // Exponentially-weighted mean/variance with a *time*-based weight, so the
      // drift speed doesn't depend on the camera's frame rate.
      const alpha = 1 - Math.exp(-dt / cfg.baselineTimeConstantMs);
      const diff = obs.value - baseline.mean;
      const increment = alpha * diff;
      baselines.set(obs.signal, {
        ...baseline,
        mean: baseline.mean + increment,
        variance: (1 - alpha) * (baseline.variance + diff * increment),
        sampleCount: baseline.sampleCount + 1,
        updatedAt: obs.timestamp,
      });
    },

    getBaseline(signal) {
      const b = baselines.get(signal);
      return b ? { ...b } : null;
    },

    getBaselines() {
      return [...baselines.values()].map((b) => ({ ...b }));
    },

    clearBaseline(signal) {
      if (signal) {
        baselines.delete(signal);
        smoothers.delete(signal);
        lastUnstableAt.delete(signal);
      } else {
        baselines.clear();
        smoothers.clear();
        lastUnstableAt.clear();
      }
    },
  };
}
