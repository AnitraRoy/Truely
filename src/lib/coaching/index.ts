/**
 * coaching module (PRD §7.3, §7.4, §8) — the cue state machine.
 * Owner: Personalization team (shared with UI for cue rendering).
 *
 * Responsibilities:
 *  - Apply goal-specific rules (which signals matter).
 *  - Evaluate persistence of a deviation over a time window.
 *  - Manage cooldowns.
 *  - Select cue text from the library.
 *  - Handle user feedback (helpful / not helpful / too distracting).
 *
 * Implements the explicit state machine in PRD §7.4 and the 10 rules in §8.
 */

import type {
  CoachingEvent,
  CoachingGoal,
  CueFeedback,
  CueState,
  DeviationAssessment,
} from "@/types";

export interface CoachingEngine {
  /** Drive the state machine with one assessment + tracking confidence. */
  tick(input: {
    assessment: DeviationAssessment | null;
    trackingConfidence: number;
    now: number;
  }): CueState;
  /** The cue to display right now, if the machine is in CUE_VISIBLE. */
  getActiveCue(): CoachingEvent | null;
  dismissActiveCue(): void;
  pause(): void;
  resume(): void;
  /** Record the user's verdict on a past cue (PRD §7.5). */
  recordFeedback(eventId: string, feedback: CueFeedback): void;
  /** All cue events generated this session. */
  getEvents(): CoachingEvent[];
  setGoal(goal: CoachingGoal): void;
}

// TODO(personalization-team): implement the §7.4 state machine + §8 rules.
export function createCoachingEngine(): CoachingEngine {
  throw new Error("coaching.createCoachingEngine not implemented");
}
