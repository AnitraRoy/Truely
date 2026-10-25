/**
 * Pacing of a reference speaker, measured from timed captions.
 *
 * Captions are not audio, so these numbers are approximate and always shown as
 * such. They describe observable delivery (speed and pauses), never the
 * speaker. Pure functions, no network: the model is handed the numbers rather
 * than asked to guess pacing from text.
 */
import { PACING_PAUSE_SECONDS } from "@/config/conversation";
import type { SpeechMetrics } from "@/types";

export interface CaptionLine {
  start: number;
  end: number;
  text: string;
}

/** Keep only well-formed caption lines (the actor's JSON is untrusted input). */
export function toCaptionLines(raw: unknown): CaptionLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CaptionLine[] = [];
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    const text = typeof o.text === "string" ? o.text : "";
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start && text.trim()) out.push({ start, end, text });
  }
  return out.sort((a, b) => a.start - b.start);
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Words per minute, pauses per minute and the longest pause. Returns null when
 * there is too little timed speech (under 30 s or 40 words) to say anything.
 */
export function computeSpeechMetrics(lines: CaptionLine[]): SpeechMetrics | null {
  if (lines.length < 2) return null;
  const words = lines.reduce((n, l) => n + wordCount(l.text), 0);
  const spanSec = lines[lines.length - 1].end - lines[0].start;
  if (words < 40 || spanSec < 30) return null;

  // Gaps between consecutive lines. Overlaps (auto-captions often overlap) are not pauses.
  let pauses = 0;
  let longest = 0;
  let pausedSec = 0;
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].start - lines[i - 1].end;
    if (gap >= PACING_PAUSE_SECONDS) {
      pauses++;
      pausedSec += gap;
      longest = Math.max(longest, gap);
    }
  }
  // Speed while speaking: pauses are removed, so a quiet stretch doesn't read as a slow speaker.
  const speakingMin = Math.max(spanSec - pausedSec, 1) / 60;
  const spanMin = spanSec / 60;
  return {
    wordsPerMinute: Math.round(words / speakingMin),
    pausesPerMinute: Math.round((pauses / spanMin) * 10) / 10,
    longestPauseSec: Math.round(longest * 10) / 10,
    minutesMeasured: Math.round(spanMin * 10) / 10,
  };
}

/** One sentence the model is told to treat as measured fact. */
export function describeSpeechMetrics(m: SpeechMetrics): string {
  return (
    `Pacing measured from caption timing (approximate, over ${m.minutesMeasured} min): ` +
    `about ${m.wordsPerMinute} words per minute while speaking, ` +
    `${m.pausesPerMinute} pauses of a second or more per minute, longest pause ${m.longestPauseSec} s.`
  );
}
