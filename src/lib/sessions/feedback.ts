/**
 * Feedback for SAVED sessions (report screen, history).
 * While a session is live/just ended, use `controller.submitFeedback` instead —
 * it also updates the running coaching engine. Both paths feed the same
 * adaptation counts (PRD §7.5).
 */

import { adjustCount, emptyCounts, type CueAdaptationState } from "@/lib/coaching/adaptation";
import type { CueStorage } from "@/lib/storage";
import type { CueFeedback, Session } from "@/types";

/** Pure: returns updated copies, or null if the event doesn't exist. */
export function applyFeedbackToSession(
  session: Session,
  adaptation: CueAdaptationState,
  eventId: string,
  feedback: CueFeedback,
): { session: Session; adaptation: CueAdaptationState } | null {
  const event = session.events.find((e) => e.id === eventId);
  if (!event) return null;

  const nextAdaptation: CueAdaptationState = {};
  for (const [signal, counts] of Object.entries(adaptation)) {
    if (counts) nextAdaptation[signal as keyof CueAdaptationState] = { ...counts };
  }
  const counts = (nextAdaptation[event.signal] ??= emptyCounts());
  if (event.feedback) adjustCount(counts, event.feedback, -1); // user changed their answer
  adjustCount(counts, feedback, 1);

  return {
    session: {
      ...session,
      events: session.events.map((e) => (e.id === eventId ? { ...e, feedback } : e)),
    },
    adaptation: nextAdaptation,
  };
}

/** Storage-backed version for sessions opened from history. Returns the updated session. */
export async function recordFeedbackForSavedSession(
  storage: CueStorage,
  sessionId: string,
  eventId: string,
  feedback: CueFeedback,
  /** `adapt: false` keeps the answer but leaves cue timing (adaptation) unchanged. */
  opts: { adapt?: boolean } = {},
): Promise<Session | null> {
  const session = await storage.getSession(sessionId);
  if (!session) return null;
  const result = applyFeedbackToSession(session, await storage.loadAdaptation(), eventId, feedback);
  if (!result) return null;
  await storage.saveSession(result.session);
  if (opts.adapt !== false) await storage.saveAdaptation(result.adaptation);
  return result.session;
}
