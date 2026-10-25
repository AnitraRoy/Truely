import type { LevelSample } from "./levelMeter";

/**
 * How much speech one recorded clip held, from LevelMeter samples taken at a
 * fixed tick while it recorded. Used to keep silent answers (and silent chunks
 * of a live conversation) away from transcription, where speech-to-text tends
 * to invent words from silence.
 *
 * A clip counts as measured only if the meter was actually running for enough
 * ticks; otherwise the caller can't tell silence from "not listening" and
 * should not treat the clip as silent. A muted microphone reads as running but
 * never active, so it does count as silent.
 */
export interface SpeechSummary {
  measured: boolean;
  voicedMs: number;
}

export class SpeechTally {
  private runningTicks = 0;
  private voicedTicks = 0;

  constructor(
    private readonly tickMs: number,
    private readonly minRunningTicks = 3,
  ) {}

  add(sample: LevelSample, running: boolean): void {
    if (!running) return;
    this.runningTicks += 1;
    if (sample.active) this.voicedTicks += 1;
  }

  summary(): SpeechSummary {
    return { measured: this.runningTicks >= this.minRunningTicks, voicedMs: this.voicedTicks * this.tickMs };
  }
}

/** True only when the clip was measured and held less speech than `minVoicedMs`. */
export function isSilentClip(s: SpeechSummary, minVoicedMs: number): boolean {
  return s.measured && s.voicedMs < minVoicedMs;
}
