/**
 * Session recorder — turns the per-tick state of the coaching engine into the
 * report's raw material: deviation / tracking-gap / paused segments and a
 * downsampled deviation series. Pure & deterministic; no timers, no React.
 *
 * Honesty rules baked in:
 *  - Series points are only recorded for trusted measurements (confidence ≥ min).
 *    Dropped/low-confidence frames leave a GAP, never a made-up value.
 *  - A deviation segment is kept only if it lasted ≥ minDeviationSegmentMs
 *    (or led to a cue), so single noisy frames don't pad the "events" count.
 *  - Deviation segments end at the last frame that was actually deviating,
 *    not when the engine's gap tolerance expired.
 */

import { resolveCoachingConfig, type CoachingConfigOverrides } from "@/config/coaching";
import type { CueState, DeviationAssessment, SeriesPoint, SessionSegment, SignalName } from "@/types";

export const DEFAULT_MIN_DEVIATION_SEGMENT_MS = 1000;
export const DEFAULT_SERIES_INTERVAL_MS = 500;
export const DEFAULT_MAX_SERIES_POINTS = 20_000;

export interface RecorderOptions {
  config?: CoachingConfigOverrides;
  seriesIntervalMs?: number;
  minDeviationSegmentMs?: number;
  /** Safety cap on memory/storage; recording of the series stops beyond it. */
  maxSeriesPoints?: number;
}

export interface RecorderInput {
  now: number;
  /** State returned by `coaching.tick()` for this input. */
  state: CueState;
  assessment: DeviationAssessment | null;
  /** Set on the tick in which a new cue became visible. */
  newCueId?: string;
}

export interface RecorderOutput {
  segments: SessionSegment[];
  series: SeriesPoint[];
}

export interface SessionRecorder {
  observe(input: RecorderInput): void;
  /** Output so far, with open segments closed at `now` (does not mutate the recorder). */
  snapshot(now: number): RecorderOutput;
  /** Finish: close open segments and return the final output. */
  close(now: number): RecorderOutput;
  /** Number of completed deviation segments so far. */
  getDeviationCount(): number;
}

export function createSessionRecorder(options: RecorderOptions = {}): SessionRecorder {
  const cfg = resolveCoachingConfig(options.config);
  const seriesInterval = options.seriesIntervalMs ?? DEFAULT_SERIES_INTERVAL_MS;
  const minDeviationMs = options.minDeviationSegmentMs ?? DEFAULT_MIN_DEVIATION_SEGMENT_MS;
  const maxPoints = options.maxSeriesPoints ?? DEFAULT_MAX_SERIES_POINTS;

  const segments: SessionSegment[] = [];
  const series: SeriesPoint[] = [];
  const lastSeriesAt = new Map<SignalName, number>();

  let dev: { start: number; lastRelevantAt: number | null; signal?: SignalName } | null = null;
  let gapStart: number | null = null;
  let pausedStart: number | null = null;

  function finishDeviation(cue?: { at: number; eventId: string }) {
    if (!dev) return;
    const d = dev;
    dev = null;
    const end = cue ? cue.at : (d.lastRelevantAt ?? d.start);
    if (!cue && end - d.start < minDeviationMs) return;
    segments.push({ kind: "deviation", start: d.start, end, signal: d.signal, eventId: cue?.eventId });
  }
  function finishSpan(kind: "tracking_gap" | "paused", start: number, end: number) {
    if (end > start) segments.push({ kind, start, end });
  }

  return {
    observe({ now, state, assessment, newCueId }) {
      // Deviation stretches
      if (state === "CANDIDATE_DEVIATION") dev ??= { start: now, lastRelevantAt: null };
      if (dev && assessment?.isRelevantDeviation) {
        dev.lastRelevantAt = now;
        dev.signal ??= assessment.signal;
      }
      if (newCueId) finishDeviation({ at: now, eventId: newCueId });
      else if (state !== "CANDIDATE_DEVIATION") finishDeviation();

      // Paused / tracking-gap spans
      if (state === "PAUSED") pausedStart ??= now;
      else if (pausedStart !== null) {
        finishSpan("paused", pausedStart, now);
        pausedStart = null;
      }
      if (state === "TRACKING_UNAVAILABLE") gapStart ??= now;
      else if (gapStart !== null) {
        finishSpan("tracking_gap", gapStart, now);
        gapStart = null;
      }

      // Downsampled series — trusted measurements only
      if (
        assessment &&
        state !== "PAUSED" &&
        state !== "TRACKING_UNAVAILABLE" &&
        assessment.confidence >= cfg.minTrackingConfidence &&
        Number.isFinite(assessment.deviationMagnitude) &&
        series.length < maxPoints
      ) {
        const last = lastSeriesAt.get(assessment.signal);
        if (last === undefined || now - last >= seriesInterval) {
          lastSeriesAt.set(assessment.signal, now);
          series.push({
            t: now,
            signal: assessment.signal,
            z: assessment.deviationMagnitude,
            confidence: assessment.confidence,
          });
        }
      }
    },

    snapshot(now) {
      const extra: SessionSegment[] = [];
      if (dev) {
        const end = dev.lastRelevantAt ?? dev.start;
        if (end - dev.start >= minDeviationMs) {
          extra.push({ kind: "deviation", start: dev.start, end, signal: dev.signal });
        }
      }
      if (pausedStart !== null && now > pausedStart) extra.push({ kind: "paused", start: pausedStart, end: now });
      if (gapStart !== null && now > gapStart) extra.push({ kind: "tracking_gap", start: gapStart, end: now });
      return {
        segments: [...segments, ...extra].sort((a, b) => a.start - b.start),
        series: [...series],
      };
    },

    close(now) {
      finishDeviation();
      if (pausedStart !== null) finishSpan("paused", pausedStart, now);
      if (gapStart !== null) finishSpan("tracking_gap", gapStart, now);
      pausedStart = gapStart = null;
      return { segments: [...segments].sort((a, b) => a.start - b.start), series: [...series] };
    },

    getDeviationCount: () => segments.filter((s) => s.kind === "deviation").length,
  };
}
