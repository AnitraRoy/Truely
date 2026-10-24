/**
 * Cue — Shared type contract
 * =============================================================================
 * THIS FILE IS THE INTEGRATION BOUNDARY BETWEEN TEAMS.
 *
 * Every module (vision, signals, personalization, coaching, sessions,
 * reports, storage) and every screen talks to the rest of the app through
 * the types declared here. Treat it as a shared API:
 *   - Changes require a quick heads-up / PR review so no one's work breaks.
 *   - Add new fields as optional when possible to stay backward compatible.
 *
 * Source: PRD §10 (Data Models). Adapt as implementation demands.
 * =============================================================================
 */

/** The single behavioral goal a user picks for a session (PRD §5, §10). */
export type CoachingGoal =
  | "camera_engagement"
  | "head_movement"
  | "general_awareness";

/** High-level session status surfaced in the Live screen (PRD §6 Screen C). */
export type SessionStatus =
  | "calibrating"
  | "ready"
  | "observing"
  | "paused"
  | "ended"
  | "tracking_unavailable";

/** Explicit cue state machine (PRD §7.4). Owned by the coaching module. */
export type CueState =
  | "OBSERVING"
  | "CANDIDATE_DEVIATION"
  | "COOLDOWN"
  | "CUE_VISIBLE"
  | "PAUSED"
  | "TRACKING_UNAVAILABLE";

/** User's verdict on a shown cue (PRD §6 Screen D, §7.5). */
export type CueFeedback = "helpful" | "not_helpful" | "too_distracting";

/** Names of the behavioral signals the MVP can measure (PRD §7.1). */
export type SignalName =
  | "head_orientation"
  | "gaze_direction"
  | "movement_variability";

// -----------------------------------------------------------------------------
// Vision layer (produced by `lib/vision`)
// -----------------------------------------------------------------------------

/** One frame's worth of face-landmark output (PRD §9 vision module). */
export interface VisionFrame {
  timestamp: number;
  /** True when a face was detected with usable quality this frame. */
  faceDetected: boolean;
  /** 0..1 — how much to trust this frame's estimates. */
  trackingConfidence: number;
  /** Estimated head orientation in degrees (imperfect proxy — PRD §7.1). */
  headPose?: { yaw: number; pitch: number; roll: number };
  /** Optional broad gaze-direction estimate, if conditions allow. */
  gaze?: { x: number; y: number };
}

// -----------------------------------------------------------------------------
// Signals layer (produced by `lib/signals`)
// -----------------------------------------------------------------------------

/** A smoothed, normalized measurement for one signal (PRD §10). */
export interface SignalObservation {
  timestamp: number;
  signal: SignalName;
  value: number;
  /** 0..1 measurement confidence. */
  confidence: number;
  /** False when tracking was too poor to trust this observation. */
  valid: boolean;
}

// -----------------------------------------------------------------------------
// Personalization layer (produced by `lib/personalization`)
// -----------------------------------------------------------------------------

/** Per-signal personal baseline learned during calibration (PRD §7.2, §10). */
export interface BehavioralBaseline {
  signal: SignalName;
  sampleCount: number;
  mean: number;
  variance: number;
  calibrationDurationMs: number;
  updatedAt: number;
}

/** Result of comparing a live observation to the personal baseline. */
export interface DeviationAssessment {
  signal: SignalName;
  /** How far current behavior sits from baseline, in std-devs (z-score). */
  deviationMagnitude: number;
  /** True once the deviation is both large enough and relevant to the goal. */
  isRelevantDeviation: boolean;
  confidence: number;
}

// -----------------------------------------------------------------------------
// Coaching layer (produced by `lib/coaching`)
// -----------------------------------------------------------------------------

/**
 * What the measured signal did in the window after a cue (PRD §6 Screen D).
 * Purely observational — NEVER evidence that the cue caused the change.
 */
export type ObservedChange =
  | "closer_to_baseline"
  | "no_clear_change"
  | "further_from_baseline"
  | "insufficient_data";

/** Measurements around a cue, in baseline std-devs (z-scores). */
export interface CueResponseSummary {
  /** Mean deviation while the pattern was building, just before the cue. */
  preDeviation: number;
  /** Mean deviation over the response window (undefined if no samples). */
  postMeanDeviation?: number;
  postSampleCount: number;
  /** False if the session ended (or tracking was lost) before the window closed. */
  windowComplete: boolean;
  observedChange: ObservedChange;
}

/** A single coaching intervention record (PRD §10). */
export interface CoachingEvent {
  id: string;
  timestamp: number;
  signal: SignalName;
  deviationMagnitude?: number;
  confidence: number;
  cueText: string;
  feedback?: CueFeedback;
  /** End of the window in which we observe the signal's response. */
  responseWindowEnd?: number;
  /** True if the user dismissed the cue; false if it expired on its own. */
  dismissed?: boolean;
  /** Filled in once the response window closes (or the session ends). */
  response?: CueResponseSummary;
}

// -----------------------------------------------------------------------------
// Sessions layer (produced by `lib/sessions`)
// -----------------------------------------------------------------------------

/** A full coaching session (PRD §10). */
export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  goal: CoachingGoal;
  status: SessionStatus;
  eventCount: number;
  cueCount: number;
  events: CoachingEvent[];
}

/** Lightweight summary for lists/dashboard (derived by `lib/reports`). */
export interface SessionSummary {
  id: string;
  startedAt: number;
  durationMs: number;
  goal: CoachingGoal;
  eventCount: number;
  cueCount: number;
}