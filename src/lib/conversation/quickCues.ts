/**
 * Instant cues measured from one transcribed answer, with no model call, so
 * they appear the moment the answer is transcribed (before Moss replies):
 * speaking pace, filler words, and length. Pure functions; thresholds live in
 * config/conversation.ts (QUICK_CUES).
 *
 * Only for the person's own answers (practice modes). A live conversation's
 * lines aren't labelled by speaker, so these would misfire there.
 * They describe what was measured, never the person (CLAUDE.md §5).
 */
import { QUICK_CUES } from "@/config/conversation";
import type { TranscriptSegment } from "@/types";
import type { ParsedSuggestion } from "./parse";

const FILLERS = /\b(um+|uh+|erm+|er|ah+|basically|literally|you know|kind of|sort of|i mean)\b|(?:^|,\s*)like(?=\s*,)/gi;

const wordsIn = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Filler words in a line, lower-cased, in order. */
export function findFillers(text: string): string[] {
  return (text.match(FILLERS) ?? []).map((f) => f.replace(/^,\s*/, "").toLowerCase());
}

/** Words per minute over the segment, or null when it's too short to tell. */
export function wordsPerMinute(seg: TranscriptSegment): number | null {
  const minutes = (seg.endMs - seg.startMs) / 60000;
  if (minutes * 60000 < QUICK_CUES.minPaceMs) return null;
  return Math.round(wordsIn(seg.text) / minutes);
}

export function quickCues(seg: TranscriptSegment): ParsedSuggestion[] {
  const cues: ParsedSuggestion[] = [];
  const words = wordsIn(seg.text);

  const wpm = wordsPerMinute(seg);
  if (wpm != null && wpm > QUICK_CUES.fastWpm) {
    cues.push({ category: "pacing", title: "Slow down", explanation: `About ${wpm} words a minute. Aim nearer ${QUICK_CUES.targetWpm}.` });
  }

  const fillers = findFillers(seg.text);
  if (fillers.length >= QUICK_CUES.minFillers && fillers.length / Math.max(words, 1) >= QUICK_CUES.fillerRate) {
    const examples = [...new Set(fillers)].slice(0, 2).map((f) => `"${f}"`).join(" and ");
    cues.push({ category: "clarity", title: "Cut filler words", explanation: `${fillers.length} fillers, like ${examples}. Pause instead.` });
  }

  if (words > QUICK_CUES.longAnswerWords) {
    cues.push({ category: "conciseness", title: "Wrap it up", explanation: `About ${words} words. Make your point, then stop.` });
  }
  return cues;
}
