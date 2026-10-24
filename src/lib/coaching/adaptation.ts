/**
 * Feedback → cue-frequency adaptation (PRD §7.5). Transparent rules, no learning:
 *  - "too distracting"  → longer cooldown for that signal, compounding, capped.
 *  - "not helpful"      → never MORE aggressive; cooldown factor is configurable (default: unchanged).
 *  - "helpful"          → recorded, but we don't speed cues up (conservative).
 */

import type { CoachingConfig } from "@/config/coaching";
import type { CueFeedback, SignalName } from "@/types";

export interface FeedbackCounts {
  helpful: number;
  notHelpful: number;
  tooDistracting: number;
}

/** Serializable — the storage layer can persist this between sessions. */
export type CueAdaptationState = Partial<Record<SignalName, FeedbackCounts>>;

export function emptyCounts(): FeedbackCounts {
  return { helpful: 0, notHelpful: 0, tooDistracting: 0 };
}

const FIELD: Record<CueFeedback, keyof FeedbackCounts> = {
  helpful: "helpful",
  not_helpful: "notHelpful",
  too_distracting: "tooDistracting",
};

export function adjustCount(counts: FeedbackCounts, feedback: CueFeedback, delta: 1 | -1): void {
  const key = FIELD[feedback];
  counts[key] = Math.max(0, counts[key] + delta);
}

/** Multiplier (≥ 1) applied to the base cooldown for this signal. */
export function cooldownMultiplier(
  counts: FeedbackCounts | undefined,
  config: Pick<
    CoachingConfig,
    "tooDistractingCooldownFactor" | "notHelpfulCooldownFactor" | "maxCooldownMultiplier"
  >,
): number {
  if (!counts) return 1;
  const raw =
    Math.pow(config.tooDistractingCooldownFactor, counts.tooDistracting) *
    Math.pow(config.notHelpfulCooldownFactor, counts.notHelpful);
  return Math.min(config.maxCooldownMultiplier, Math.max(1, raw));
}
