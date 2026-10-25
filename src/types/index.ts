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
  /** Number of detected deviation stretches (derived from `segments`). */
  eventCount: number;
  /** Cue events generated this session (including any shown while muted). */
  cueCount: number;
  events: CoachingEvent[];
  /** Timeline segments: deviations, tracking gaps, paused periods. Added by `lib/sessions`. */
  segments?: SessionSegment[];
  /** Downsampled deviation series (≈2 Hz) for the report charts. NO raw frames. */
  series?: SeriesPoint[];
  /** Cue ids that fired while the user had visual notifications muted. */
  mutedCueIds?: string[];
}

/** What a timeline segment represents (derived by `lib/sessions/recorder`). */
export type SegmentKind = "deviation" | "tracking_gap" | "paused";

/** A period on the session timeline. Timestamps share the frame clock (Date.now ms). */
export interface SessionSegment {
  kind: SegmentKind;
  start: number;
  end: number;
  signal?: SignalName;
  /** For deviations: the cue this pattern led to, if any. */
  eventId?: string;
}

/** One downsampled measurement: deviation from baseline in std-devs (z-score). */
export interface SeriesPoint {
  t: number;
  signal: SignalName;
  z: number;
  confidence: number;
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

// -----------------------------------------------------------------------------
// Conversation practice (voice coaching, mock interviews, live transcripts)
// Added for the Moss / Cartesia / Apify integrations. All additive: behavioral
// `Session` above is unchanged. Every timestamp below is ms from the start of
// its session, so transcripts, feedback, recordings and report markers share
// ONE clock (the same convention as the video review player).
// -----------------------------------------------------------------------------

/** Which practice surface produced a conversation session. */
export type ConversationKind = "voice" | "interview" | "live";

/** Who said a transcript line. "other" = someone else in a real conversation. */
export type SpeakerRole = "you" | "coach" | "interviewer" | "other";

/** One transcribed utterance. `speaker` is a display label, only when known. */
export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  role?: SpeakerRole;
}

/** Communication aspects feedback can be about (never traits of the person). */
export type FeedbackCategory =
  | "clarity"
  | "conciseness"
  | "structure"
  | "pacing"
  | "relevance"
  | "warmth"
  | "delivery";

/**
 * A timestamped suggestion or observation. `segmentId` points at the
 * transcript line it is based on; feedback without evidence is never shown in
 * a report (CLAUDE.md §5).
 */
export interface FeedbackEvent {
  id: string;
  atMs: number;
  category: FeedbackCategory;
  title: string;
  explanation: string;
  suggestion?: string;
  segmentId?: string;
}

/** A transcript line the report calls out, with the reason. */
export interface ReportMoment {
  segmentId: string;
  label: string;
  note: string;
}

/** Post-session reflection, generated from the transcript only. No score. */
export interface ConversationReport {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  moments: ReportMoment[];
}

/** A local recording, saved only with explicit consent. The blob lives in storage. */
export interface RecordingRef {
  blobKey: string;
  mimeType: string;
  hasVideo: boolean;
  durationMs: number;
}

export interface ConversationSession {
  id: string;
  kind: ConversationKind;
  title: string;
  startedAt: number;
  endedAt?: number;
  /** The practice goals chosen for this session, in the person's words. */
  goals: string[];
  /** e.g. interview type, role, difficulty. Display strings. */
  context?: Record<string, string>;
  transcript: TranscriptSegment[];
  feedback: FeedbackEvent[];
  report?: ConversationReport;
  recording?: RecordingRef;
  /** The behavioral (webcam) session recorded alongside, if signals were on. */
  behavioralSessionId?: string;
  /** Development sample, never real data. Always labelled in the UI. */
  sample?: boolean;
}

/** One communication pattern the person wants to work toward. */
export interface StyleTrait {
  id: string;
  category: FeedbackCategory;
  name: string;
  description: string;
  /** A short quote from the reference that shows it, when one exists. */
  evidence?: string;
  keep: boolean;
}

/** Where a desired style came from. Public material or text the person pasted. */
export interface StyleReference {
  source: "youtube" | "pasted";
  url?: string;
  title?: string;
  /** Character count of the material analysed (never the full text). */
  analysedChars?: number;
}

/**
 * Desired communication profile: how the person wants to come across.
 * Separate from `BehavioralBaseline`, which is what calibration measured.
 */
export interface CommunicationProfile {
  reference?: StyleReference;
  admire: string;
  contexts: string[];
  /** One-line restatement of what the person asked for. */
  intent?: string;
  traits: StyleTrait[];
  updatedAt: number;
}
