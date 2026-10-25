import { useRef, useState } from "react";
import { VOICE_MAX_SUGGESTIONS } from "@/config/conversation";
import type { ParsedSuggestion } from "@/lib/conversation";
import { newId } from "@/state/conversations";
import type { CommunicationProfile, FeedbackEvent, TranscriptSegment } from "@/types";
import { useAnswerCues } from "./useAnswerCues";

/**
 * The cues of one practice session (voice coaching, mock interview): what the
 * call room shows (`suggestions`, newest first) and everything given, kept for
 * the report (`feedback`). Owner: Coaching + Integration.
 *
 * Cues come from three places, all through `add`: during an answer as soon as
 * an issue shows up (useAnswerCues, fed by `progress`), instant checks on the
 * final transcript (`settle`), and the model's notes after the answer. Cues
 * found mid-answer have no transcript line yet; `settle` ties them to it.
 */
export function usePracticeCues({ enabled, profile, goals }: { enabled: boolean; profile: CommunicationProfile | null; goals: string[] }) {
  const [suggestions, setSuggestions] = useState<FeedbackEvent[]>([]);
  const feedback = useRef<FeedbackEvent[]>([]);
  const pending = useRef<string[]>([]);
  const answerStart = useRef(0);
  /** The question or prompt being answered; screens keep it current. */
  const question = useRef("");

  const add = (found: ParsedSuggestion[], atMs: number, segmentId?: string) => {
    if (found.length === 0) return;
    const events: FeedbackEvent[] = found.map((s) => ({ id: newId("fb"), atMs, ...(segmentId ? { segmentId } : {}), ...s }));
    if (!segmentId) pending.current.push(...events.map((e) => e.id));
    feedback.current = [...feedback.current, ...events];
    setSuggestions((prev) => [...events, ...prev].slice(0, VOICE_MAX_SUGGESTIONS));
  };

  const answerCues = useAnswerCues({
    enabled,
    question: () => question.current,
    profile,
    goals,
    previous: () => feedback.current.map((f) => f.title),
    onCue: (cue, ms) => add([cue], answerStart.current + ms),
  });

  /** An answer starts at `atMs` on the session clock. */
  const beginAnswer = (atMs: number) => {
    answerCues.reset();
    answerStart.current = atMs;
  };

  /** The answer was transcribed: one more instant check, then tie mid-answer cues to its line. */
  const settle = (transcript: TranscriptSegment[]) => {
    const answer = transcript[transcript.length - 1];
    if (answer?.role !== "you") return;
    answerCues.finish(answer.text, answer.endMs - answer.startMs);
    const ids = new Set(pending.current);
    pending.current = [];
    if (ids.size === 0) return;
    const link = (f: FeedbackEvent) => (ids.has(f.id) ? { ...f, segmentId: answer.id } : f);
    feedback.current = feedback.current.map(link);
    setSuggestions((prev) => prev.map(link));
  };

  return { suggestions, setSuggestions, feedback, question, add, progress: answerCues.progress, beginAnswer, settle };
}
