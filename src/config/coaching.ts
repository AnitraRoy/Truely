/**
 * Centralized thresholds + cooldown configuration (PRD §7.3, §13 Maintainability).
 *
 * All magic numbers that govern WHEN a cue fires live here — never hardcode
 * them inside the vision/coaching loop. Tuning these is how we demo
 * personalization without touching logic. Owner: Personalization team.
 *
 * Every engine accepts `Partial` overrides (see `resolveCoachingConfig`), so
 * tests and demos can tweak behavior without editing this file.
 */

import type { CoachingGoal, SignalName } from "@/types";

export interface CoachingConfig {
  // ---- Detection ------------------------------------------------------------
  /** How long a deviation must persist before it becomes a cue (ms). */
  persistenceWindowMs: number;
  /** Minimum tracking confidence to make any coaching decision (0..1). */
  minTrackingConfidence: number;
  /** Deviation size, in baseline std-devs, to count as "relevant". */
  deviationZThreshold: number;
  /** Fraction of assessments inside a candidate window that must be relevant. */
  minRelevantFraction: number;
  /** A candidate survives this long without a relevant assessment (ms). */
  candidateGapToleranceMs: number;
  /** Low-confidence tracking must last this long before TRACKING_UNAVAILABLE (ms). */
  trackingLossGraceMs: number;

  // ---- Smoothing ------------------------------------------------------------
  /** Time constant of the EMA applied to observations before comparison (ms). */
  smoothingTimeConstantMs: number;

  // ---- Cue timing -----------------------------------------------------------
  /** Minimum gap between two cues, measured from when the first one ended (ms). */
  cueCooldownMs: number;
  /** How long a cue stays on screen before auto-dismiss (ms). */
  cueVisibleMs: number;
  /** Window after a cue in which we observe the signal's response (ms). */
  responseWindowMs: number;

  // ---- No endless nagging (PRD §6: "never repeat indefinitely") -------------
  /** Signal must look normal this long for the "unrecovered cue" count to reset (ms). */
  recoveryMs: number;
  /** After this many cues for one signal without recovery, stop cueing it. */
  maxUnrecoveredCues: number;
  /** Cooldown grows by this factor for each repeat without recovery. */
  repeatBackoffFactor: number;

  // ---- Feedback adaptation (PRD §7.5) ---------------------------------------
  /** Cooldown multiplier per "too distracting" answer for that signal. */
  tooDistractingCooldownFactor: number;
  /** Cooldown multiplier per "not helpful" answer (1 = never more aggressive, no change). */
  notHelpfulCooldownFactor: number;
  /** Upper bound on any combined cooldown multiplier. */
  maxCooldownMultiplier: number;

  // ---- Response measurement (PRD §6 Screen D) -------------------------------
  /** Minimum post-cue samples before we say anything about the response. */
  minResponseSamples: number;
  /** Change in mean z-score needed to call the response "closer"/"further". */
  responseChangeMinZ: number;

  // ---- Calibration & baseline updates ---------------------------------------
  /** Calibration: minimum valid observations before a baseline is accepted. */
  minCalibrationSamples: number;
  /** Calibration target duration shown to the user (ms). */
  calibrationDurationMs: number;
  /** Time constant for slow baseline drift during stable periods (ms). */
  baselineTimeConstantMs: number;
  /** Observations beyond this many std-devs never update the baseline. */
  baselineStableZ: number;
  /** After an unstable moment, freeze baseline updates for this long (ms). */
  baselineUpdateHoldMs: number;
  /**
   * Floor on a baseline's std-dev, in each signal's own units. Stops an
   * unusually steady calibration from making every wobble look "huge".
   * ASSUMPTION: head_orientation ≈ degrees, gaze_direction ≈ normalized offset,
   * movement_variability ≈ degrees. Re-tune once `lib/signals` fixes its units.
   */
  minStdDev: Record<SignalName, number>;
}

export const COACHING_CONFIG: Readonly<CoachingConfig> = {
  persistenceWindowMs: 2500,
  minTrackingConfidence: 0.6,
  deviationZThreshold: 2.0,
  minRelevantFraction: 0.8,
  candidateGapToleranceMs: 600,
  trackingLossGraceMs: 500,

  smoothingTimeConstantMs: 300,

  cueCooldownMs: 20000,
  cueVisibleMs: 6000,
  responseWindowMs: 8000,

  recoveryMs: 5000,
  maxUnrecoveredCues: 2,
  repeatBackoffFactor: 1.5,

  tooDistractingCooldownFactor: 2,
  notHelpfulCooldownFactor: 1,
  maxCooldownMultiplier: 8,

  minResponseSamples: 10,
  responseChangeMinZ: 0.5,

  minCalibrationSamples: 150,
  calibrationDurationMs: 45000,
  baselineTimeConstantMs: 120000,
  baselineStableZ: 1.5,
  baselineUpdateHoldMs: 10000,
  minStdDev: {
    head_orientation: 2.0,
    gaze_direction: 0.05,
    movement_variability: 0.5,
  },
};

export type CoachingConfigOverrides = Partial<Omit<CoachingConfig, "minStdDev">> & {
  minStdDev?: Partial<Record<SignalName, number>>;
};

/** Merge overrides onto the defaults (including the nested `minStdDev` map). */
export function resolveCoachingConfig(
  overrides: CoachingConfigOverrides = {},
): CoachingConfig {
  return {
    ...COACHING_CONFIG,
    ...overrides,
    minStdDev: { ...COACHING_CONFIG.minStdDev, ...(overrides.minStdDev ?? {}) },
  };
}

/** Which signals each goal prioritizes, in priority order (PRD §6 Screen B). */
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

/**
 * Goal-specific wording where the same signal means different things per goal.
 * Falls back to CUE_LIBRARY. (Head orientation is only a proxy — we say
 * "turn toward the camera", never "make eye contact".)
 */
export const GOAL_CUE_OVERRIDES: Partial<
  Record<CoachingGoal, Partial<Record<SignalName, string>>>
> = {
  camera_engagement: {
    head_orientation: "Try turning back toward the camera when it feels natural.",
  },
};

/** A position in the head-range part of calibration. Directions are the person's own. */
export type HeadDirection = "center" | "up" | "down" | "left" | "right";

/**
 * Head-range calibration (the first part of the baseline): the person looks
 * up, down, left and right so the vision engine can sample their comfortable
 * range of movement. Each position is held for `holdMs`. Copy stays gentle:
 * "as far as is comfortable", never a target to hit.
 */
export const HEAD_RANGE_CALIBRATION = {
  holdMs: 3500,
  /**
   * Movement detection (UI side): a position only counts while the person's head
   * is actually in it. Values are in the head-pose proxy's own unitless scale
   * (`estimateHeadPose`: nose offset / face width for yaw, nose position between
   * forehead and chin for pitch), measured as a change from the person's own
   * centre pose, so they are personal rather than absolute angles.
   * UNTUNED: first estimates, roughly 12-15 degrees. Check on a real camera with
   * `?headdebug=1` on the calibration page, which prints the live readings.
   */
  detect: {
    /** How far the head must move from centre to count as "left"/"right". */
    yawDelta: 0.07,
    /** How far the head must move from centre to count as "up"/"down". */
    pitchDelta: 0.05,
    /** +1: turning to the person's left raises the raw yaw proxy. Flip if `?headdebug=1` shows the opposite. */
    yawLeftSign: 1,
    /** -1: tilting up lowers the raw pitch proxy. Flip if `?headdebug=1` shows the opposite. */
    pitchUpSign: -1,
    /** Used for the up/down/left/right checks only if the person skips the centre position. */
    fallbackNeutral: { yaw: 0, pitch: 0.55 },
    /** How long a position may drop out before the hold restarts (ms). */
    graceMs: 700,
    /** After this long without the movement, offer a hint and the skip (ms). */
    hintAfterMs: 8000,
    /** Give up loading face tracking and fall back to the timer (ms). */
    loadTimeoutMs: 15000,
    /** How often the preview is sampled (ms). */
    pollMs: 100,
    /** Most recent centre samples used to find the person's centre pose. */
    neutralMaxSamples: 40,
  },
  steps: [
    { direction: "center", label: "Centre", prompt: "Look at the screen", instruction: "Look at the screen as you normally would" },
    { direction: "up", label: "Up", prompt: "Tilt your head up", instruction: "Tilt your head up a little" },
    { direction: "down", label: "Down", prompt: "Tilt your head down", instruction: "Now tilt your head down" },
    { direction: "left", label: "Left", prompt: "Turn left", instruction: "Turn your head to your left" },
    { direction: "right", label: "Right", prompt: "Turn right", instruction: "Turn your head to your right" },
  ] as const satisfies ReadonlyArray<{
    direction: HeadDirection;
    label: string;
    /** Short text drawn on the preview. */
    prompt: string;
    /** Full sentence, announced to screen readers. */
    instruction: string;
  }>,
} as const;

export const TRACKING_LIMITED_MESSAGE =
  "Tracking is limited. Adjust your lighting or camera position.";

/**
 * Sample cues the live screen rotates through to showcase the overlay before the
 * vision pipeline emits real ones. Always labelled as samples in the UI: they are
 * not observations of the person (CLAUDE.md §5). Drawn from the cue library so the
 * copy stays in one place.
 */
export const SAMPLE_CUES: readonly string[] = Array.from(
  new Set([
    ...Object.values(CUE_LIBRARY),
    ...Object.values(GOAL_CUE_OVERRIDES).flatMap((byGoal) => Object.values(byGoal ?? {})),
  ]),
);

/** Sample-cue rotation timing (ms). Shorter gap than `cueCooldownMs`, for demos. */
export const SAMPLE_CUE_TIMING = {
  firstDelayMs: 3000,
  visibleMs: COACHING_CONFIG.cueVisibleMs,
  gapMs: 5000,
} as const;
