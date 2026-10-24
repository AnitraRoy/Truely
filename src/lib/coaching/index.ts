/**
 * coaching module (PRD §7.3, §7.4, §8) — the cue state machine.
 * Owner: Personalization team (shared with UI for cue rendering).
 *
 * Responsibilities:
 *  - Apply goal-specific rules (which signals matter).
 *  - Evaluate persistence of a deviation over a time window.
 *  - Manage cooldowns (adapted by user feedback).
 *  - Select cue text from the library.
 *  - Record each cue + what the signal did afterwards.
 *  - Handle user feedback (helpful / not helpful / too distracting).
 *
 * States (PRD §7.4):
 *   OBSERVING → CANDIDATE_DEVIATION → CUE_VISIBLE → COOLDOWN → OBSERVING
 *   PAUSED (user) and TRACKING_UNAVAILABLE (low confidence) can interrupt any of them.
 *
 * The engine is pure TypeScript with no timers: time only advances through
 * `tick({ now })`, which makes it deterministic and easy to unit-test.
 */

import {
  CUE_LIBRARY,
  GOAL_CUE_OVERRIDES,
  GOAL_SIGNALS,
  resolveCoachingConfig,
  type CoachingConfigOverrides,
} from "@/config/coaching";
import type {
  CoachingEvent,
  CoachingGoal,
  CueFeedback,
  CueState,
  DeviationAssessment,
  SignalName,
} from "@/types";
import {
  adjustCount,
  cooldownMultiplier,
  emptyCounts,
  type CueAdaptationState,
  type FeedbackCounts,
} from "./adaptation";
import { createResponseTracker, type FinalizedResponse } from "./response";

export type { CueAdaptationState, FeedbackCounts } from "./adaptation";

export interface CoachingEngine {
  /** Drive the state machine with one assessment + tracking confidence. */
  tick(input: {
    assessment: DeviationAssessment | null;
    trackingConfidence: number;
    now: number;
  }): CueState;
  /** The cue to display right now, if the machine is in CUE_VISIBLE. */
  getActiveCue(): CoachingEvent | null;
  dismissActiveCue(): void;
  pause(): void;
  resume(): void;
  /** Record the user's verdict on a past cue (PRD §7.5). */
  recordFeedback(eventId: string, feedback: CueFeedback): void;
  /** All cue events generated this session (snapshots; they update as feedback/response arrive). */
  getEvents(): CoachingEvent[];
  setGoal(goal: CoachingGoal): void;

  getState(): CueState;
  /**
   * Call when the session ends: closes any open response windows (marked
   * incomplete if cut short) and returns the final events. Replace the
   * session's events with this list — events are updated after emission.
   */
  endSession(now?: number): CoachingEvent[];
  /** Feedback counts to persist between sessions (PRD §7.5). */
  getAdaptationState(): CueAdaptationState;
  /** Called with a snapshot whenever an event is created or updated. Returns unsubscribe. */
  subscribe(listener: (event: CoachingEvent) => void): () => void;
}

export interface CoachingEngineOptions {
  goal?: CoachingGoal;
  config?: CoachingConfigOverrides;
  /** Feedback history from previous sessions. */
  adaptation?: CueAdaptationState;
  /** Fallback clock for pause/resume/dismiss when no tick has happened yet. */
  clock?: () => number;
  idFactory?: () => string;
}

/** Pick the cue text for a goal + signal (PRD §8 cue mapping). */
export function selectCueText(goal: CoachingGoal, signal: SignalName): string {
  return GOAL_CUE_OVERRIDES[goal]?.[signal] ?? CUE_LIBRARY[signal];
}

interface Candidate {
  startedAt: number;
  lastRelevantAt: number;
  relevant: number;
  total: number;
  zSum: number;
  confSum: number;
}

interface SignalMemory {
  /** Cues shown for this signal since it last looked normal. */
  unrecovered: number;
  nonRelevantSince: number | null;
}

function cloneEvent(e: CoachingEvent): CoachingEvent {
  return e.response ? { ...e, response: { ...e.response } } : { ...e };
}

export function createCoachingEngine(options: CoachingEngineOptions = {}): CoachingEngine {
  const cfg = resolveCoachingConfig(options.config);
  const clock = options.clock ?? Date.now;
  let idCounter = 0;
  const makeId = options.idFactory ?? (() => `cue-${clock().toString(36)}-${++idCounter}`);

  let goal: CoachingGoal = options.goal ?? "general_awareness";
  let state: CueState = "OBSERVING";
  let paused = false;
  let lastNow: number | null = null;

  const events: CoachingEvent[] = [];
  let activeCue: CoachingEvent | null = null;
  let cueExpiresAt = 0;
  let lastCueEndedAt: number | null = null;
  let lastCueSignal: SignalName | null = null;
  let lowConfidenceSince: number | null = null;

  const candidates = new Map<SignalName, Candidate>();
  const memory = new Map<SignalName, SignalMemory>();
  const tracker = createResponseTracker(cfg);
  const listeners = new Set<(event: CoachingEvent) => void>();

  const adaptation: Partial<Record<SignalName, FeedbackCounts>> = {};
  for (const [signal, counts] of Object.entries(options.adaptation ?? {})) {
    if (counts) adaptation[signal as SignalName] = { ...counts };
  }

  // ---- helpers --------------------------------------------------------------

  const currentTime = () => lastNow ?? clock();
  const isGoalSignal = (s: SignalName) => GOAL_SIGNALS[goal].includes(s);

  function mem(signal: SignalName): SignalMemory {
    let m = memory.get(signal);
    if (!m) memory.set(signal, (m = { unrecovered: 0, nonRelevantSince: null }));
    return m;
  }

  function notify(event: CoachingEvent) {
    for (const l of listeners) l(cloneEvent(event));
  }

  function applyResponses(done: FinalizedResponse[]) {
    for (const { eventId, summary } of done) {
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        ev.response = summary;
        notify(ev);
      }
    }
  }

  /** Effective cooldown after the most recent cue: base × feedback × repeat backoff (PRD §7.5, §6). */
  function cooldownMs(signal: SignalName): number {
    const backoff = Math.pow(cfg.repeatBackoffFactor, Math.max(0, mem(signal).unrecovered - 1));
    const multiplier = Math.min(
      cfg.maxCooldownMultiplier,
      cooldownMultiplier(adaptation[signal], cfg) * backoff,
    );
    return cfg.cueCooldownMs * multiplier;
  }

  function inCooldown(now: number): boolean {
    return (
      lastCueEndedAt !== null &&
      lastCueSignal !== null &&
      now < lastCueEndedAt + cooldownMs(lastCueSignal)
    );
  }

  /** Too many cues for a signal that never went back to normal → stay quiet about it. */
  const isSuppressed = (s: SignalName) => mem(s).unrecovered >= cfg.maxUnrecoveredCues;

  function restingState(now: number): CueState {
    if (activeCue) return "CUE_VISIBLE";
    if (inCooldown(now)) return "COOLDOWN";
    return candidates.size > 0 ? "CANDIDATE_DEVIATION" : "OBSERVING";
  }

  function endActiveCue(at: number, outcome: "dismissed" | "expired") {
    if (!activeCue) return;
    const ended = activeCue;
    ended.dismissed = outcome === "dismissed";
    activeCue = null;
    lastCueEndedAt = at;
    lastCueSignal = ended.signal;
    notify(ended);
  }

  function pruneCandidates(now: number) {
    for (const [signal, c] of candidates) {
      if (now - c.lastRelevantAt > cfg.candidateGapToleranceMs) candidates.delete(signal);
    }
  }

  function trackRecovery(a: DeviationAssessment, now: number) {
    const m = mem(a.signal);
    if (a.isRelevantDeviation) {
      m.nonRelevantSince = null;
      return;
    }
    m.nonRelevantSince ??= now;
    if (now - m.nonRelevantSince >= cfg.recoveryMs) m.unrecovered = 0;
  }

  function accumulate(a: DeviationAssessment, confidence: number, now: number) {
    pruneCandidates(now);
    if (!isGoalSignal(a.signal) || isSuppressed(a.signal)) return;

    let c = candidates.get(a.signal);
    if (a.isRelevantDeviation) {
      if (!c) {
        c = { startedAt: now, lastRelevantAt: now, relevant: 0, total: 0, zSum: 0, confSum: 0 };
        candidates.set(a.signal, c);
      }
      c.lastRelevantAt = now;
      c.relevant += 1;
      c.total += 1;
      c.zSum += a.deviationMagnitude;
      c.confSum += confidence;
    } else if (c) {
      c.total += 1;
    }
  }

  function findSustained(now: number): [SignalName, Candidate] | null {
    for (const signal of GOAL_SIGNALS[goal]) {
      const c = candidates.get(signal);
      if (
        c &&
        now - c.startedAt >= cfg.persistenceWindowMs &&
        c.relevant / c.total >= cfg.minRelevantFraction
      ) {
        return [signal, c];
      }
    }
    return null;
  }

  function fire(signal: SignalName, c: Candidate, now: number) {
    const preDeviation = c.zSum / c.relevant;
    const event: CoachingEvent = {
      id: makeId(),
      timestamp: now,
      signal,
      deviationMagnitude: preDeviation,
      confidence: c.confSum / c.relevant,
      cueText: selectCueText(goal, signal),
      responseWindowEnd: now + cfg.responseWindowMs,
    };
    events.push(event);
    activeCue = event;
    cueExpiresAt = now + cfg.cueVisibleMs;
    mem(signal).unrecovered += 1;
    candidates.clear();
    tracker.open(event.id, signal, now, event.responseWindowEnd!, preDeviation);
    notify(event);
  }

  // ---- public API -----------------------------------------------------------

  return {
    tick({ assessment, trackingConfidence, now }) {
      lastNow = now;
      if (paused) return (state = "PAUSED"); // Rule 3: no decisions while paused.

      applyResponses(tracker.advance(now));
      if (activeCue && now >= cueExpiresAt) endActiveCue(cueExpiresAt, "expired");

      // Rule 1: no cue without sufficient tracking confidence. A brief dropout
      // only pauses decisions; sustained loss clears evidence and reports it.
      const confidence = assessment
        ? Math.min(trackingConfidence, assessment.confidence)
        : trackingConfidence;
      if (confidence < cfg.minTrackingConfidence) {
        lowConfidenceSince ??= now;
        if (now - lowConfidenceSince >= cfg.trackingLossGraceMs) {
          endActiveCue(now, "expired");
          candidates.clear();
          return (state = "TRACKING_UNAVAILABLE");
        }
        return (state = restingState(now));
      }
      lowConfidenceSince = null;

      if (assessment && isGoalSignal(assessment.signal)) {
        tracker.record(assessment.signal, assessment.deviationMagnitude, now);
        trackRecovery(assessment, now);
      }

      if (activeCue) return (state = "CUE_VISIBLE"); // Rule 4: no duplicate cue.
      if (inCooldown(now)) {
        candidates.clear(); // Rule 5: evidence doesn't build up during cooldown.
        return (state = "COOLDOWN");
      }

      if (assessment) accumulate(assessment, confidence, now);
      else pruneCandidates(now);

      const ready = findSustained(now); // Rule 2: only sustained patterns.
      if (ready) fire(ready[0], ready[1], now);
      return (state = restingState(now));
    },

    getActiveCue: () => (activeCue ? cloneEvent(activeCue) : null),

    dismissActiveCue() {
      if (!activeCue) return;
      endActiveCue(currentTime(), "dismissed");
      if (!paused) state = restingState(currentTime());
    },

    pause() {
      endActiveCue(currentTime(), "expired");
      candidates.clear();
      paused = true;
      state = "PAUSED";
    },

    resume() {
      paused = false;
      lowConfidenceSince = null;
      candidates.clear();
      state = restingState(currentTime());
    },

    recordFeedback(eventId, feedback) {
      const ev = events.find((e) => e.id === eventId);
      if (!ev) return;
      const counts = (adaptation[ev.signal] ??= emptyCounts());
      if (ev.feedback) adjustCount(counts, ev.feedback, -1); // user changed their answer
      ev.feedback = feedback;
      adjustCount(counts, feedback, 1);
      notify(ev);
    },

    getEvents: () => events.map(cloneEvent),

    setGoal(next) {
      if (next === goal) return;
      goal = next;
      candidates.clear();
    },

    getState: () => state,

    endSession(now) {
      const t = now ?? currentTime();
      endActiveCue(t, "expired");
      candidates.clear();
      applyResponses(tracker.closeAll(t));
      return events.map(cloneEvent);
    },

    getAdaptationState() {
      const out: CueAdaptationState = {};
      for (const [signal, counts] of Object.entries(adaptation)) {
        if (counts) out[signal as SignalName] = { ...counts };
      }
      return out;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
