/**
 * Response tracker — records what the measured signal did after a cue
 * (PRD §6 Screen D). Observation only: it never claims the cue worked.
 */

import type { CoachingConfig } from "@/config/coaching";
import type { CueResponseSummary, ObservedChange, SignalName } from "@/types";

interface OpenWindow {
  eventId: string;
  signal: SignalName;
  startedAt: number;
  windowEnd: number;
  pre: number;
  sum: number;
  count: number;
}

export interface FinalizedResponse {
  eventId: string;
  summary: CueResponseSummary;
}

type ResponseConfig = Pick<CoachingConfig, "minResponseSamples" | "responseChangeMinZ">;

export interface ResponseTracker {
  open(eventId: string, signal: SignalName, now: number, windowEnd: number, preDeviation: number): void;
  /** Add one trusted measurement (z-score) for a signal. */
  record(signal: SignalName, deviation: number, now: number): void;
  /** Close windows whose time has passed. */
  advance(now: number): FinalizedResponse[];
  /** Close everything (session end) — windows still open are marked incomplete. */
  closeAll(now: number): FinalizedResponse[];
}

function summarize(w: OpenWindow, complete: boolean, cfg: ResponseConfig): CueResponseSummary {
  const post = w.count > 0 ? w.sum / w.count : undefined;
  let observedChange: ObservedChange = "insufficient_data";
  if (post !== undefined && w.count >= cfg.minResponseSamples) {
    const delta = post - w.pre;
    observedChange =
      delta <= -cfg.responseChangeMinZ
        ? "closer_to_baseline"
        : delta >= cfg.responseChangeMinZ
          ? "further_from_baseline"
          : "no_clear_change";
  }
  return {
    preDeviation: w.pre,
    postMeanDeviation: post,
    postSampleCount: w.count,
    windowComplete: complete,
    observedChange,
  };
}

export function createResponseTracker(cfg: ResponseConfig): ResponseTracker {
  let windows: OpenWindow[] = [];

  return {
    open(eventId, signal, now, windowEnd, preDeviation) {
      windows.push({ eventId, signal, startedAt: now, windowEnd, pre: preDeviation, sum: 0, count: 0 });
    },

    record(signal, deviation, now) {
      for (const w of windows) {
        if (w.signal === signal && now > w.startedAt && now <= w.windowEnd) {
          w.sum += deviation;
          w.count += 1;
        }
      }
    },

    advance(now) {
      const done: FinalizedResponse[] = [];
      windows = windows.filter((w) => {
        if (now <= w.windowEnd) return true;
        done.push({ eventId: w.eventId, summary: summarize(w, true, cfg) });
        return false;
      });
      return done;
    },

    closeAll(now) {
      const done = windows.map((w) => ({
        eventId: w.eventId,
        summary: summarize(w, now >= w.windowEnd, cfg),
      }));
      windows = [];
      return done;
    },
  };
}
