/**
 * signals module (PRD §9, §7.1)
 * Owner: Computer-Vision team (shared with Personalization).
 *
 * Responsibilities:
 *  - Extract behavioral features from VisionFrames.
 *  - Smooth noisy measurements over time.
 *  - Normalize measurements (unit-independent thresholds — PRD §7.2).
 *  - Estimate signal validity.
 */

import type { SignalName, SignalObservation, VisionFrame } from "@/types";

export interface SignalExtractor {
  /** Feed one frame; returns the observation for the given signal, or null. */
  update(frame: VisionFrame, signal: SignalName): SignalObservation | null;
  reset(): void;
}

// TODO(cv-team): implement smoothing (EMA) + normalization per signal.
export function createSignalExtractor(): SignalExtractor {
  throw new Error("signals.createSignalExtractor not implemented");
}
