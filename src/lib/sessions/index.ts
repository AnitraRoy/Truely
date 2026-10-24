/**
 * sessions module (PRD §9)
 * Owner: Data team.
 *
 * Responsibilities:
 *  - Start and end sessions.
 *  - Record timestamps and derived events.
 *  - Maintain session metrics (eventCount, cueCount).
 *  - Produce report data on end.
 */

import type { CoachingEvent, CoachingGoal, Session } from "@/types";

export interface SessionManager {
  start(goal: CoachingGoal): Session;
  addEvent(event: CoachingEvent): void;
  end(): Session;
  getCurrent(): Session | null;
}

// TODO(data-team): implement in-memory session accumulation.
export function createSessionManager(): SessionManager {
  throw new Error("sessions.createSessionManager not implemented");
}
