/**
 * personalization module (PRD §7, §9) — THE CORE DIFFERENTIATOR.
 * Owner: Personalization team.
 *
 * Responsibilities:
 *  - Create/load per-signal baselines from calibration observations.
 *  - Estimate baseline variability.
 *  - Compare live observations against the personal baseline.
 *  - Update baselines conservatively (pause during deviations — PRD §7.2).
 *  - Manage recalibration.
 *
 * No large ML model. Transparent, understandable, runs locally (PRD §7).
 */

import type {
  BehavioralBaseline,
  DeviationAssessment,
  SignalName,
  SignalObservation,
} from "@/types";

export interface PersonalizationEngine {
  /** Build a baseline from a batch of calibration observations. */
  calibrate(signal: SignalName, obs: SignalObservation[]): BehavioralBaseline;
  /** Load a previously stored baseline. */
  loadBaseline(baseline: BehavioralBaseline): void;
  /** Compare one observation to the baseline → deviation assessment. */
  assess(obs: SignalObservation): DeviationAssessment;
  /** Slowly nudge the baseline during stable periods only. */
  updateDuringStablePeriod(obs: SignalObservation): void;
  getBaseline(signal: SignalName): BehavioralBaseline | null;
}

// TODO(personalization-team): implement mean/variance + z-score comparison.
export function createPersonalizationEngine(): PersonalizationEngine {
  throw new Error("personalization.createPersonalizationEngine not implemented");
}
