/**
 * Centralized thresholds + cooldown configuration (PRD §7.3, §13 Maintainability).
 *
 * All magic numbers that govern WHEN a cue fires live here — never hardcode
 * them inside the vision/coaching loop. Tuning these is how we demo
 * personalization without touching logic. Owner: Personalization team.
 */

import type { CoachingGoal, SignalName } from "@/types";

export const COACHING_CONFIG = {
  /** How long a deviation must persist before it becomes a candidate (ms). */
  persistenceWindowMs: 2500,
  /** Minimum tracking confidence to make any coaching decision (0..1). */
  minTrackingConfidence: 0.6,
  /** Deviation size, in baseline std-devs, to count as "relevant". */
  deviationZThreshold: 2.0,
  /** Minimum gap between two cues (ms). */
  cueCooldownMs: 20000,
  /** How long a cue stays on screen before auto-dismiss (ms). */
  cueVisibleMs: 6000,
  /** Window after a cue in which we observe the signal's response (ms). */
  responseWindowMs: 8000,
  /** Calibration: minimum valid observations before a baseline is accepted. */
  minCalibrationSamples: 150,
  /** Calibration target duration shown to the user (ms). */
  calibrationDurationMs: 45000,
  /** EMA factor for slow baseline updates during stable periods (0..1). */
  baselineUpdateAlpha: 0.02,
} as const;

/** Which signals each goal prioritizes (PRD §6 Screen B). */
export const GOAL_SIGNALS: Record<CoachingGoal, SignalName[]> = {
  camera_engagement: ["gaze_direction", "head_orientation"],
  head_movement: ["movement_variability", "head_orientation"],
  general_awareness: ["head_orientation"],
};

/** Human-readable goal labels for the UI. */
export const GOAL_LABELS: Record<CoachingGoal, string> = {
  camera_engagement: "Camera engagement",
  head_movement: "Head movement awareness",
  general_awareness: "General on-camera habits",
};

/**
 * The configurable cue library (PRD §8). Keep copy supportive and
 * observational — never a judgment. Tracking messages are status, not coaching.
 */
export const CUE_LIBRARY: Record<SignalName, string> = {
  gaze_direction: "Try bringing your gaze back toward the camera.",
  head_orientation: "Notice your movement and find a comfortable position.",
  movement_variability:
    "Notice your head movement and settle into a comfortable position.",
};

export const TRACKING_LIMITED_MESSAGE =
  "Tracking is limited. Adjust your lighting or camera position.";
