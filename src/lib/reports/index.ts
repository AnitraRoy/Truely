/**
 * reports module (PRD §6 Screen D, §9). Owner: Integration (Person 4).
 *
 * Pure functions: Session in → report data out. Nothing here invents data:
 *  - no overall "communication score"
 *  - insights are emitted only when the recorded session supports them
 *  - responses are described as observations, never as "success" or causation
 */

import { GOAL_LABELS } from "@/config/coaching";
import { DEFAULT_MIN_DEVIATION_SEGMENT_MS } from "@/lib/sessions/recorder";
import type {
  CoachingEvent,
  CoachingGoal,
  CueFeedback,
  ObservedChange,
  SeriesPoint,
  Session,
  SessionSegment,
  SessionSummary,
  SignalName,
} from "@/types";

export const SIGNAL_LABELS: Record<SignalName, string> = {
  head_orientation: "head orientation",
  gaze_direction: "gaze direction",
  movement_variability: "head movement",
};

export const NO_INSIGHTS_MESSAGE = "Not enough data in this session to highlight a pattern.";

/** How much measured signal to show before/after a cue in the detail panel (ms). */
export const DETAIL_BEFORE_MS = 10_000;
export const DETAIL_AFTER_MS = 8_000;

// ---- helpers ---------------------------------------------------------------------

export function sessionDurationMs(session: Session): number {
  if (session.endedAt !== undefined) return Math.max(0, session.endedAt - session.startedAt);
  const lastSeg = Math.max(session.startedAt, ...(session.segments ?? []).map((s) => s.end));
  const lastEvt = Math.max(session.startedAt, ...session.events.map((e) => e.timestamp));
  return Math.max(0, Math.max(lastSeg, lastEvt) - session.startedAt);
}

const spanMs = (segs: SessionSegment[], kind: SessionSegment["kind"]) =>
  segs.filter((s) => s.kind === kind).reduce((n, s) => n + (s.end - s.start), 0);

const wasShown = (session: Session, e: CoachingEvent) => !(session.mutedCueIds ?? []).includes(e.id);

export function toSessionSummary(session: Session): SessionSummary {
  return {
    id: session.id,
    startedAt: session.startedAt,
    durationMs: sessionDurationMs(session),
    goal: session.goal,
    eventCount: session.eventCount,
    cueCount: session.cueCount,
  };
}

// ---- summary ---------------------------------------------------------------------

export interface ReportSummary {
  durationMs: number;
  goal: CoachingGoal;
  goalLabel: string;
  /** Stretches away from the personal baseline that lasted long enough to record. */
  deviationCount: number;
  /** Cues generated, and how many were actually visible to the user (not muted). */
  cueCount: number;
  cuesShown: number;
  cuesDismissed: number;
  feedbackGiven: number;
  /** Observation counts only — NOT a success rate. */
  observedChanges: Record<ObservedChange, number>;
  trackingLimitedMs: number;
  pausedMs: number;
}

export function buildSummary(session: Session): ReportSummary {
  const segs = session.segments ?? [];
  const observedChanges: Record<ObservedChange, number> = {
    closer_to_baseline: 0,
    no_clear_change: 0,
    further_from_baseline: 0,
    insufficient_data: 0,
  };
  for (const e of session.events) {
    observedChanges[e.response?.observedChange ?? "insufficient_data"] += 1;
  }
  return {
    durationMs: sessionDurationMs(session),
    goal: session.goal,
    goalLabel: GOAL_LABELS[session.goal],
    deviationCount: session.eventCount,
    cueCount: session.events.length,
    cuesShown: session.events.filter((e) => wasShown(session, e)).length,
    cuesDismissed: session.events.filter((e) => e.dismissed === true).length,
    feedbackGiven: session.events.filter((e) => e.feedback !== undefined).length,
    observedChanges,
    trackingLimitedMs: spanMs(segs, "tracking_gap"),
    pausedMs: spanMs(segs, "paused"),
  };
}

// ---- timeline --------------------------------------------------------------------

export type TimelineItemKind = "deviation" | "cue" | "response_window" | "tracking_gap" | "paused";

export interface TimelineItem {
  id: string;
  kind: TimelineItemKind;
  /** Offsets from session start, in ms. A cue is a point (start === end). */
  startMs: number;
  endMs: number;
  label: string;
  signal?: SignalName;
  /** Present on cue / response_window / the deviation that led to a cue. */
  eventId?: string;
  /** Cue fired while visual notifications were muted. */
  mutedCue?: boolean;
}

export interface Timeline {
  durationMs: number;
  items: TimelineItem[];
}

export function buildTimeline(session: Session): Timeline {
  const durationMs = sessionDurationMs(session);
  const t0 = session.startedAt;
  const clampEnd = (ms: number) => Math.min(Math.max(ms, 0), durationMs);
  const items: TimelineItem[] = [];

  (session.segments ?? []).forEach((s, i) => {
    const label =
      s.kind === "deviation"
        ? s.signal
          ? `Moved away from your baseline (${SIGNAL_LABELS[s.signal]})`
          : "Moved away from your baseline"
        : s.kind === "tracking_gap"
          ? "Tracking limited"
          : "Coaching paused";
    items.push({
      id: `${s.kind}-${i}`,
      kind: s.kind,
      startMs: clampEnd(s.start - t0),
      endMs: clampEnd(s.end - t0),
      label,
      signal: s.signal,
      eventId: s.eventId,
    });
  });

  for (const e of session.events) {
    const at = clampEnd(e.timestamp - t0);
    items.push({
      id: `cue-${e.id}`,
      kind: "cue",
      startMs: at,
      endMs: at,
      label: e.cueText,
      signal: e.signal,
      eventId: e.id,
      mutedCue: !wasShown(session, e),
    });
    if (e.responseWindowEnd !== undefined) {
      items.push({
        id: `response-${e.id}`,
        kind: "response_window",
        startMs: at,
        endMs: clampEnd(e.responseWindowEnd - t0),
        label: "Measured after the cue",
        signal: e.signal,
        eventId: e.id,
      });
    }
  }
  return { durationMs, items: items.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs) };
}

// ---- event detail ----------------------------------------------------------------

export interface EventDetail {
  eventId: string;
  /** Offset from session start (ms) and absolute timestamp. */
  offsetMs: number;
  timestamp: number;
  signal: SignalName;
  signalLabel: string;
  cueText: string;
  /** What was measured. */
  observation: string;
  /** Why the cue was generated. */
  reason: string;
  /** What the measured signal did afterwards — an observation, not causation. */
  afterwards: string;
  observedChange: ObservedChange;
  shownToUser: boolean;
  dismissed?: boolean;
  feedback?: CueFeedback;
  /** Measured deviation (std-devs from baseline) around the cue. */
  before: SeriesPoint[];
  after: SeriesPoint[];
}

export function buildEventDetail(session: Session, eventId: string): EventDetail | null {
  const e = session.events.find((x) => x.id === eventId);
  if (!e) return null;
  const label = SIGNAL_LABELS[e.signal];
  const segment = (session.segments ?? []).find((s) => s.kind === "deviation" && s.eventId === e.id);
  const seconds = segment ? Math.round((e.timestamp - segment.start) / 1000) : null;

  const observation =
    e.deviationMagnitude !== undefined
      ? `Your ${label} stayed about ${e.deviationMagnitude.toFixed(1)} standard deviations away from your personal baseline` +
        (seconds && seconds > 0 ? ` for about ${seconds} second${seconds === 1 ? "" : "s"}.` : ".")
      : `Your ${label} moved away from your personal baseline.`;

  const reason =
    `The pattern lasted longer than a brief moment, tracking confidence was ${Math.round(e.confidence * 100)}%, ` +
    `and no other cue was visible or cooling down. ${GOAL_LABELS[session.goal]} was your selected goal.`;

  const r = e.response;
  let afterwards: string;
  if (!r) {
    afterwards = "No response measurement was recorded for this cue.";
  } else if (r.observedChange === "insufficient_data" || r.postMeanDeviation === undefined) {
    afterwards = r.windowComplete
      ? "There weren't enough reliable measurements after this cue to say what happened."
      : "The session ended before enough measurements were collected after this cue.";
  } else {
    const pre = r.preDeviation.toFixed(1);
    const post = r.postMeanDeviation.toFixed(1);
    const how =
      r.observedChange === "closer_to_baseline"
        ? "was closer to your baseline"
        : r.observedChange === "further_from_baseline"
          ? "was further from your baseline"
          : "stayed about the same";
    afterwards =
      `After the cue the measured ${label} ${how} (average ${post} vs ${pre} before). ` +
      "This is an observation; it doesn't show that the cue caused the change.";
  }

  const series = (session.series ?? []).filter((p) => p.signal === e.signal);
  const windowEnd = e.responseWindowEnd ?? e.timestamp + DETAIL_AFTER_MS;
  return {
    eventId: e.id,
    offsetMs: e.timestamp - session.startedAt,
    timestamp: e.timestamp,
    signal: e.signal,
    signalLabel: label,
    cueText: e.cueText,
    observation,
    reason,
    afterwards,
    observedChange: r?.observedChange ?? "insufficient_data",
    shownToUser: wasShown(session, e),
    dismissed: e.dismissed,
    feedback: e.feedback,
    before: series.filter((p) => p.t >= e.timestamp - DETAIL_BEFORE_MS && p.t <= e.timestamp),
    after: series.filter((p) => p.t > e.timestamp && p.t <= windowEnd),
  };
}

// ---- insights --------------------------------------------------------------------

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** At most three insights, each backed by recorded data. May return []. */
export function buildInsights(session: Session): string[] {
  const duration = sessionDurationMs(session);
  const segs = session.segments ?? [];
  const devs = segs.filter((s) => s.kind === "deviation");
  const out: { text: string; priority: number }[] = [];

  // Tracking quality (honesty first when it's significant).
  const gaps = segs.filter((s) => s.kind === "tracking_gap");
  const gapMs = spanMs(segs, "tracking_gap");
  if (duration > 0 && (gapMs / duration >= 0.1 || gaps.length >= 3)) {
    out.push({
      priority: 0,
      text: `Tracking was limited for about ${Math.round((gapMs / duration) * 100)}% of the session, so some patterns may not have been detected.`,
    });
  }

  if (devs.length > 0) {
    const secs = Math.max(1, Math.round(DEFAULT_MIN_DEVIATION_SEGMENT_MS / 1000));
    out.push({
      priority: 1,
      text: `${plural(devs.length, "stretch", "stretches")} away from your personal baseline lasted at least ${plural(secs, "second")}.`,
    });
  }

  const withData = session.events.filter(
    (e) => e.response && e.response.observedChange !== "insufficient_data",
  );
  if (withData.length > 0) {
    const closer = withData.filter((e) => e.response!.observedChange === "closer_to_baseline");
    out.push({
      priority: 2,
      text:
        closer.length > 0
          ? `After ${closer.length} of ${plural(withData.length, "cue")} with enough data, the measured signal was closer to your baseline (an observation, not proof the cue caused it).`
          : `After ${plural(withData.length, "cue")} with enough data, the measured signal didn't move closer to your baseline.`,
    });
  }

  if (devs.length >= 2 && duration >= 30_000) {
    const third = duration / 3;
    const bins = [0, 0, 0];
    for (const s of devs) {
      for (let i = 0; i < 3; i++) {
        const lo = session.startedAt + i * third;
        bins[i] += Math.max(0, Math.min(s.end, lo + third) - Math.max(s.start, lo));
      }
    }
    const total = bins.reduce((a, b) => a + b, 0);
    const top = bins.indexOf(Math.max(...bins));
    if (total > 0 && bins[top] / total >= 0.6) {
      out.push({
        priority: 3,
        text: `Most of your time away from baseline (${Math.round((bins[top] / total) * 100)}%) fell in the ${["first", "middle", "last"][top]} third of the session.`,
      });
    }
  }

  return out.sort((a, b) => a.priority - b.priority).slice(0, 3).map((i) => i.text);
}

// ---- whole report + comparison -------------------------------------------------------

export interface SessionReport {
  summary: ReportSummary;
  timeline: Timeline;
  insights: string[];
}

export function buildReport(session: Session): SessionReport {
  return { summary: buildSummary(session), timeline: buildTimeline(session), insights: buildInsights(session) };
}

export interface SessionComparison {
  comparable: boolean;
  reason?: string;
  earlier?: { deviationsPerMinute: number; cuesPerMinute: number };
  later?: { deviationsPerMinute: number; cuesPerMinute: number };
}

/** Rates per minute for two sessions with the same goal and ≥ 60 s each. Numbers only, no verdict. */
export function compareSessions(a: Session, b: Session): SessionComparison {
  const [earlier, later] = a.startedAt <= b.startedAt ? [a, b] : [b, a];
  if (earlier.goal !== later.goal) return { comparable: false, reason: "These sessions had different goals." };
  const da = sessionDurationMs(earlier);
  const db = sessionDurationMs(later);
  if (da < 60_000 || db < 60_000) return { comparable: false, reason: "Both sessions need to be at least a minute long." };
  const rate = (n: number, ms: number) => n / (ms / 60_000);
  return {
    comparable: true,
    earlier: { deviationsPerMinute: rate(earlier.eventCount, da), cuesPerMinute: rate(earlier.cueCount, da) },
    later: { deviationsPerMinute: rate(later.eventCount, db), cuesPerMinute: rate(later.cueCount, db) },
  };
}
