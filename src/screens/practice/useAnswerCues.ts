import { useCallback, useRef } from "react";
import { QUICK_CUES } from "@/config/conversation";
import { midAnswerCue, quickCues, type ParsedSuggestion } from "@/lib/conversation";
import type { CommunicationProfile } from "@/types";

/**
 * Cues during an answer, as soon as an issue shows up (practice modes).
 * Owner: Coaching + Integration.
 *
 * Fed the streaming transcript of the answer in progress (useTurnTaking's
 * `onAnswerProgress`):
 *  - instantly, on every update: pace, filler words and length (quickCues, no
 *    model call);
 *  - every few sentences: one Moss relevance check (midAnswerCue) for drifting,
 *    rambling, an unanswered part, a claim with no example.
 * Each cue title fires at most once per answer. `finish` runs the instant
 * checks once more on the final transcript, in case streaming wasn't available.
 */
export function useAnswerCues({
  enabled,
  question,
  profile,
  goals,
  previous,
  onCue,
}: {
  enabled: boolean;
  /** The question or prompt being answered now. */
  question: () => string;
  profile: CommunicationProfile | null;
  goals: string[];
  /** Titles already shown this session, newest last (so the model doesn't repeat them). */
  previous: () => string[];
  /** A cue was found; `elapsedMs` is how far into the answer. */
  onCue: (cue: ParsedSuggestion, elapsedMs: number) => void;
}) {
  const fired = useRef(new Set<string>());
  const lastCheck = useRef({ words: 0, at: 0, inFlight: false });
  const latest = useRef({ onCue, question, previous, profile, goals, enabled });
  latest.current = { onCue, question, previous, profile, goals, enabled };

  const emit = (cue: ParsedSuggestion, elapsedMs: number) => {
    const key = cue.title.toLowerCase();
    if (fired.current.has(key)) return;
    fired.current.add(key);
    latest.current.onCue(cue, elapsedMs);
  };

  /** Call when an answer starts. */
  const reset = useCallback(() => {
    fired.current = new Set();
    lastCheck.current = { words: 0, at: 0, inFlight: false };
  }, []);

  /** The answer so far (cumulative), `elapsedMs` into it. */
  const progress = useCallback((text: string, elapsedMs: number) => {
    const l = latest.current;
    if (!l.enabled || !text) return;
    for (const cue of quickCues({ id: "live", startMs: 0, endMs: elapsedMs, text })) emit(cue, elapsedMs);

    const words = text.split(/\s+/).filter(Boolean).length;
    const c = lastCheck.current;
    if (c.inFlight || words - c.words < QUICK_CUES.midCheckWords || elapsedMs - c.at < QUICK_CUES.midCheckMinMs) return;
    c.inFlight = true;
    c.words = words;
    c.at = elapsedMs;
    void midAnswerCue({ question: l.question(), partial: text, profile: l.profile, goals: l.goals, previous: l.previous() })
      .then((cue) => cue && emit(cue, elapsedMs))
      .finally(() => (lastCheck.current.inFlight = false));
  }, []);

  /** The final transcript of the answer, and how long it took. */
  const finish = useCallback((text: string, durationMs: number) => {
    if (!latest.current.enabled) return;
    for (const cue of quickCues({ id: "final", startMs: 0, endMs: durationMs, text })) emit(cue, durationMs);
  }, []);

  return { reset, progress, finish };
}
