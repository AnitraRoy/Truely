/**
 * Session controller (PRD §5, §9 sessions/) — THE integration point.
 * Owner: Integration (Person 4).
 *
 *   VisionSource ─frame→ signals ─obs→ personalization ─assessment→ coaching ─cue→ UI snapshot
 *                                                         └────────→ recorder ─→ report data
 *
 * The UI never touches the engines directly. It calls methods on this controller
 * and renders `getSnapshot()` (see `react.tsx` → `useSession()`).
 *
 * Lifecycle:  idle ─startCalibration→ calibrating ─→ calibrated ─startSession→ live ─end→ ended
 *
 * Privacy: frames are processed in memory and dropped. Anything written to
 * storage is derived data, and only if `setSaveConsent(true)` was called.
 */

import {
  GOAL_SIGNALS,
  TRACKING_LIMITED_MESSAGE,
  resolveCoachingConfig,
  type CoachingConfigOverrides,
} from "@/config/coaching";
import { createCoachingEngine, type CoachingEngine, type CueAdaptationState } from "@/lib/coaching";
import {
  CalibrationError,
  createCalibrationCollector,
  createPersonalizationEngine,
  type CalibrationCollector,
  type CalibrationProgress,
} from "@/lib/personalization";
import { createSignalExtractor, type SignalExtractor } from "@/lib/signals";
import type { CueStorage } from "@/lib/storage";
import type { VisionSource } from "@/lib/vision/types";
import type {
  BehavioralBaseline,
  CoachingEvent,
  CoachingGoal,
  CueFeedback,
  CueState,
  DeviationAssessment,
  Session,
  SessionStatus,
  SignalName,
  SignalObservation,
  VisionFrame,
} from "@/types";
import { classifyCameraError, type CueError } from "./errors";
import { recordFeedbackForSavedSession } from "./feedback";
import { createSessionRecorder, type SessionRecorder } from "./recorder";

export type Phase = "idle" | "calibrating" | "calibrated" | "live" | "ended";

export interface SessionSnapshot {
  phase: Phase;
  /** PRD §6 Screen C status (calibrating / ready / observing / paused / ended / tracking_unavailable). */
  status: SessionStatus;
  /** Raw cue state machine state ("CUE_VISIBLE" ⇒ "Cue available"). */
  cueState: CueState;
  goal: CoachingGoal;
  cameraActive: boolean;
  /** True when the latest frame had a face tracked well enough to use. */
  trackingOk: boolean;
  /** Status text (NOT a behavioral judgment) when tracking is limited; else null. */
  trackingMessage: string | null;
  /** The cue to render now. Null when none, paused, or notifications are muted. */
  activeCue: CoachingEvent | null;
  cuesMuted: boolean;
  paused: boolean;
  elapsedMs: number;
  calibration: CalibrationProgress | null;
  /** At least one signal for the current goal has a baseline. */
  hasBaseline: boolean;
  baselines: BehavioralBaseline[];
  /** Latest smoothed deviation from baseline (std-devs) for the small signal visual; null if untrusted. */
  liveDeviation: { signal: SignalName; z: number } | null;
  saveConsent: boolean;
  error: CueError | null;
  /** Current/last session. While live it only has id/goal/startedAt; full data after `end()`. */
  session: Session | null;
}

export interface SessionControllerOptions {
  vision: VisionSource;
  /** Without storage (or without consent) nothing is persisted. */
  storage?: CueStorage;
  goal?: CoachingGoal;
  config?: CoachingConfigOverrides;
  clock?: () => number;
  idFactory?: () => string;
  extractor?: SignalExtractor;
  /** Min ms between throttled UI updates (default 200). Cue changes always emit immediately. */
  emitIntervalMs?: number;
}

export interface SessionController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SessionSnapshot;
  /** Load consent, baselines and feedback history from storage. Call once on app start. */
  init(): Promise<void>;

  setGoal(goal: CoachingGoal): void;
  setSaveConsent(allowed: boolean): Promise<void>;

  startCamera(): Promise<boolean>;
  stopCamera(): void;
  /** For <video>.srcObject */
  getVisionStream(): MediaStream | null;

  startCalibration(): Promise<boolean>;
  /** Normally automatic once enough samples are collected. Returns false (and sets `error`) if not enough. */
  finishCalibration(): boolean;
  cancelCalibration(): void;
  recalibrate(): Promise<boolean>;
  resetBaseline(): Promise<void>;
  /** Inject baselines (storage restore, demo profiles). */
  loadBaselines(baselines: BehavioralBaseline[]): void;

  startSession(): Promise<boolean>;
  pause(): void;
  resume(): void;
  dismissCue(): void;
  setCuesMuted(muted: boolean): void;
  submitFeedback(eventId: string, feedback: CueFeedback, sessionId?: string): Promise<void>;
  /** Stops the camera FIRST, finalizes the session, persists if consented. */
  end(): Promise<Session | null>;

  /** Delete sessions, baselines, feedback history, consent. */
  deleteAllData(): Promise<void>;
  clearError(): void;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function createSessionController(options: SessionControllerOptions): SessionController {
  const { vision, storage } = options;
  const cfg = resolveCoachingConfig(options.config);
  const clock = options.clock ?? Date.now;
  let idCounter = 0;
  const makeId = options.idFactory ?? (() => `session-${clock().toString(36)}-${++idCounter}`);
  const extractor = options.extractor ?? createSignalExtractor();
  const emitIntervalMs = options.emitIntervalMs ?? 200;

  const personalization = createPersonalizationEngine({ config: options.config });

  // ---- state ----------------------------------------------------------------
  let goal: CoachingGoal = options.goal ?? "general_awareness";
  let phase: Phase = "idle";
  let cameraActive = false;
  let trackingOk = false;
  let error: CueError | null = null;
  let consent = false;
  let adaptation: CueAdaptationState = {};

  let collectors = new Map<SignalName, CalibrationCollector>();
  let calibration: CalibrationProgress | null = null;

  let coaching: CoachingEngine | null = null;
  let recorder: SessionRecorder | null = null;
  let session: Session | null = null;
  let paused = false;
  let muted = false;
  let mutedCueIds = new Set<string>();
  let lastCueId: string | null = null;
  let cueState: CueState = "OBSERVING";
  let liveDeviation: { signal: SignalName; z: number } | null = null;
  let lastFrameAt: number | null = null;

  let unsubFrame: (() => void) | null = null;
  let unsubError: (() => void) | null = null;

  const listeners = new Set<() => void>();
  let snapshot: SessionSnapshot;
  let lastEmitAt = -Infinity;
  let lastEmittedCueId: string | null = null;

  // ---- derived --------------------------------------------------------------
  const goalSignals = () => GOAL_SIGNALS[goal];
  const hasBaseline = () => goalSignals().some((s) => personalization.getBaseline(s) !== null);
  const calibrationSignals = (): SignalName[] => [
    ...new Set<SignalName>(["head_orientation", ...goalSignals()]),
  ];

  function status(): SessionStatus {
    if (phase === "calibrating") return "calibrating";
    if (phase === "ended") return "ended";
    if (phase === "live") {
      if (paused) return "paused";
      if (cueState === "TRACKING_UNAVAILABLE") return "tracking_unavailable";
      return "observing";
    }
    return "ready";
  }

  function build(): SessionSnapshot {
    const now = clock();
    const active = phase === "live" && !paused && coaching ? coaching.getActiveCue() : null;
    const elapsedMs = !session
      ? 0
      : phase === "ended"
        ? (session.endedAt ?? now) - session.startedAt
        : phase === "live"
          ? now - session.startedAt
          : 0;

    const limited =
      (phase === "live" && !paused && cueState === "TRACKING_UNAVAILABLE") ||
      ((phase === "calibrating" || phase === "calibrated") && cameraActive && lastFrameAt !== null && !trackingOk);

    return {
      phase,
      status: status(),
      cueState,
      goal,
      cameraActive,
      trackingOk,
      trackingMessage: limited ? TRACKING_LIMITED_MESSAGE : null,
      activeCue: muted ? null : active,
      cuesMuted: muted,
      paused,
      elapsedMs,
      calibration,
      hasBaseline: hasBaseline(),
      baselines: personalization.getBaselines(),
      liveDeviation,
      saveConsent: consent,
      error,
      session,
    };
  }

  function emit(force = true) {
    const now = clock();
    const activeId = coaching?.getActiveCue()?.id ?? null;
    if (!force && activeId === lastEmittedCueId && now - lastEmitAt < emitIntervalMs) return;
    lastEmitAt = now;
    lastEmittedCueId = activeId;
    snapshot = build();
    listeners.forEach((l) => l());
  }

  function fail(e: CueError) {
    error = e;
    emit();
  }

  // ---- persistence (consent-gated) ---------------------------------------------
  async function persist(parts: { session?: Session; baselines?: boolean; adaptation?: boolean }) {
    if (!storage || !consent) return;
    try {
      if (parts.session) await storage.saveSession(parts.session);
      if (parts.baselines) await storage.saveBaselines(personalization.getBaselines());
      if (parts.adaptation) await storage.saveAdaptation(adaptation);
    } catch (e) {
      fail({ kind: "storage", message: `Couldn't save your data locally. ${e instanceof Error ? e.message : ""}`.trim() });
    }
  }

  // ---- frames -----------------------------------------------------------------
  function handleFrame(frame: VisionFrame) {
    lastFrameAt = frame.timestamp;
    const conf = frame.faceDetected ? clamp01(frame.trackingConfidence) : 0;
    trackingOk = frame.faceDetected && conf >= cfg.minTrackingConfidence;
    const obs = extractor.extract(frame);

    if (phase === "calibrating") calibrationStep(obs);
    else if (phase === "live") liveStep(frame.timestamp, conf, obs);
    emit(false);
  }

  function calibrationStep(obs: SignalObservation[]) {
    for (const o of obs) collectors.get(o.signal)?.add(o);
    const anchor = collectors.get("head_orientation");
    if (!anchor) return;
    calibration = anchor.getProgress();
    if (calibration.ready) finishCalibration();
  }

  function liveStep(now: number, conf: number, obs: SignalObservation[]) {
    const engine = coaching!;
    const rec = recorder!;

    if (paused) {
      cueState = engine.tick({ assessment: null, trackingConfidence: conf, now });
      rec.observe({ now, state: cueState, assessment: null });
      return;
    }

    const usable = obs.filter((o) => goalSignals().includes(o.signal) && personalization.getBaseline(o.signal));
    // No usable measurement this frame (e.g. no face): still tick so tracking loss is noticed.
    const assessments: (DeviationAssessment | null)[] = usable.length ? [] : [null];
    for (const o of usable) {
      assessments.push(personalization.assess(o));
      personalization.updateDuringStablePeriod(o);
    }

    for (const a of assessments) {
      cueState = engine.tick({ assessment: a, trackingConfidence: conf, now });
      const active = engine.getActiveCue();
      const newCueId = active && active.id !== lastCueId ? active.id : undefined;
      if (newCueId) {
        lastCueId = newCueId;
        if (muted) mutedCueIds.add(newCueId);
      }
      rec.observe({ now, state: cueState, assessment: a, newCueId });
      liveDeviation =
        a && a.confidence >= cfg.minTrackingConfidence ? { signal: a.signal, z: a.deviationMagnitude } : null;
    }
  }

  // ---- camera -----------------------------------------------------------------
  // Start/stop can interleave (React StrictMode mounts, unmounts, mounts again).
  // `gen` marks the newest intent; stale starters never overwrite newer state, and a
  // stale start that finishes after the user wanted the camera OFF releases it again.
  let gen = 0;
  let wantCamera = false;
  let latestStart: Promise<boolean> | null = null;

  function activateCamera() {
    cameraActive = true;
    error = null;
    unsubFrame?.();
    unsubError?.();
    unsubFrame = vision.onFrame(handleFrame);
    unsubError =
      vision.onError?.((e) => {
        // Runtime failure (camera unplugged, model crash): release everything, keep the
        // session so the user can still end it and see what was recorded.
        error = { kind: "camera_lost", message: `The camera stopped unexpectedly. ${e.message}`.trim() };
        stopCamera();
      }) ?? null;
    emit();
  }

  function startCamera(): Promise<boolean> {
    if (cameraActive) return Promise.resolve(true);
    wantCamera = true;
    const mine = ++gen;
    const self: { promise?: Promise<boolean> } = {};
    const attempt = (async (): Promise<boolean> => {
      try {
        await vision.start();
      } catch (e) {
        if (mine === gen) {
          wantCamera = false;
          fail(classifyCameraError(e));
        }
        return false;
      }
      if (mine !== gen) {
        // Superseded while starting.
        if (!wantCamera) {
          try {
            vision.stop();
          } catch {
            /* ignore */
          }
          return false;
        }
        return latestStart && latestStart !== self.promise ? latestStart : false;
      }
      activateCamera();
      return true;
    })();
    self.promise = attempt;
    latestStart = attempt;
    return attempt;
  }

  function stopCamera() {
    wantCamera = false;
    gen += 1;
    unsubFrame?.();
    unsubError?.();
    unsubFrame = unsubError = null;
    try {
      vision.stop(); // releases every MediaStream track
    } catch {
      /* stopping must never throw into the UI */
    }
    cameraActive = false;
    trackingOk = false;
    lastFrameAt = null;
    extractor.reset();
    emit();
  }

  // ---- calibration --------------------------------------------------------------
  async function startCalibration(): Promise<boolean> {
    if (phase === "live") return false;
    if (!(await startCamera())) return false;
    extractor.reset();
    collectors = new Map(calibrationSignals().map((s) => [s, createCalibrationCollector(s, options.config)]));
    calibration = collectors.get("head_orientation")!.getProgress();
    error = null;
    phase = "calibrating";
    emit();
    return true;
  }

  function finishCalibration(): boolean {
    if (phase !== "calibrating") return false;
    let succeeded = 0;
    let firstError: CalibrationError | null = null;
    for (const [signal, collector] of collectors) {
      try {
        personalization.calibrate(signal, collector.getObservations());
        succeeded += 1;
      } catch (e) {
        // Optional signals (e.g. gaze when vision doesn't supply it) may legitimately fail.
        if (e instanceof CalibrationError) firstError ??= e;
        else throw e;
      }
    }
    collectors = new Map();

    if (succeeded === 0 || !hasBaseline()) {
      phase = "idle";
      error = {
        kind: "calibration",
        message: firstError?.message ?? "Couldn't collect enough reliable measurements. Check your lighting and camera position, then try again.",
      };
      emit();
      return false;
    }
    phase = "calibrated";
    error = null;
    emit();
    void persist({ baselines: true });
    return true;
  }

  // ---- public API -------------------------------------------------------------------
  const controller: SessionController = {
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot: () => snapshot,

    async init() {
      if (!storage) return;
      try {
        consent = await storage.getConsent();
        adaptation = await storage.loadAdaptation();
        for (const b of await storage.loadBaselines()) {
          try {
            personalization.loadBaseline(b);
          } catch {
            /* corrupt baseline → ignore, user can recalibrate */
          }
        }
      } catch (e) {
        error = { kind: "storage", message: `Couldn't read saved data. ${e instanceof Error ? e.message : ""}`.trim() };
      }
      emit();
    },

    setGoal(next) {
      if (phase === "live" || phase === "calibrating") return; // one goal per session (PRD §6)
      goal = next;
      emit();
    },

    async setSaveConsent(allowed) {
      consent = allowed;
      try {
        await storage?.setConsent(allowed);
      } catch {
        /* surfaced on the next persist */
      }
      if (allowed) await persist({ baselines: personalization.getBaselines().length > 0, adaptation: true });
      emit();
    },

    startCamera,
    stopCamera,
    getVisionStream: () => vision.getStream?.() ?? null,

    startCalibration,
    finishCalibration,
    cancelCalibration() {
      if (phase !== "calibrating") return;
      collectors = new Map();
      calibration = null;
      phase = "idle";
      emit();
    },
    async recalibrate() {
      if (phase === "live") return false;
      await controller.resetBaseline();
      return startCalibration();
    },
    async resetBaseline() {
      if (phase === "live") return;
      personalization.clearBaseline();
      calibration = null;
      if (phase === "calibrated" || phase === "calibrating") phase = "idle";
      try {
        await storage?.clearBaselines();
      } catch {
        /* ignore */
      }
      emit();
    },
    loadBaselines(baselines) {
      for (const b of baselines) personalization.loadBaseline(b);
      emit();
    },

    async startSession() {
      if (phase === "live") return false;
      if (!hasBaseline()) {
        fail({ kind: "no_baseline", message: "Cue needs a quick baseline first. Start calibration to continue." });
        return false;
      }
      if (!(await startCamera())) return false;
      extractor.reset();
      coaching = createCoachingEngine({ goal, config: options.config, adaptation, clock });
      recorder = createSessionRecorder({ config: options.config });
      session = {
        id: makeId(),
        startedAt: clock(),
        goal,
        status: "observing",
        eventCount: 0,
        cueCount: 0,
        events: [],
      };
      paused = false;
      mutedCueIds = new Set();
      lastCueId = null;
      cueState = "OBSERVING";
      liveDeviation = null;
      calibration = null;
      error = null;
      phase = "live";
      emit();
      return true;
    },

    pause() {
      if (phase !== "live" || paused) return;
      coaching?.pause();
      paused = true;
      cueState = "PAUSED";
      liveDeviation = null;
      emit();
    },
    resume() {
      if (phase !== "live" || !paused) return;
      coaching?.resume();
      paused = false;
      cueState = coaching?.getState() ?? "OBSERVING";
      emit();
    },
    dismissCue() {
      if (phase !== "live" || !coaching) return;
      coaching.dismissActiveCue();
      cueState = coaching.getState();
      emit();
    },
    setCuesMuted(next) {
      muted = next;
      emit();
    },

    async submitFeedback(eventId, feedback, sessionId) {
      const targetId = sessionId ?? session?.id;
      if (!targetId) return;

      if (session && targetId === session.id && coaching) {
        coaching.recordFeedback(eventId, feedback); // updates the running engine's adaptation too
        adaptation = coaching.getAdaptationState();
        if (phase === "ended") {
          session = { ...session, events: coaching.getEvents() };
          await persist({ session, adaptation: true });
        } else {
          await persist({ adaptation: true });
        }
        emit();
        return;
      }
      if (storage && consent) {
        const updated = await recordFeedbackForSavedSession(storage, targetId, eventId, feedback);
        if (updated) adaptation = await storage.loadAdaptation();
      }
      emit();
    },

    async end() {
      if (phase !== "live" || !session || !coaching || !recorder) {
        stopCamera();
        return null;
      }
      stopCamera(); // release the webcam before anything else (PRD §6, §12)
      const endedAt = clock();
      const events = coaching.endSession(endedAt);
      const { segments, series } = recorder.close(endedAt);
      adaptation = coaching.getAdaptationState();

      const finished: Session = {
        ...session,
        endedAt,
        status: "ended",
        events,
        cueCount: events.length,
        eventCount: segments.filter((s) => s.kind === "deviation").length,
        segments,
        series,
        mutedCueIds: [...mutedCueIds],
      };
      session = finished;
      paused = false;
      liveDeviation = null;
      phase = "ended";
      emit();
      await persist({ session: finished, baselines: true, adaptation: true });
      return finished;
    },

    async deleteAllData() {
      try {
        await storage?.deleteAllData();
      } catch {
        /* ignore */
      }
      personalization.clearBaseline();
      adaptation = {};
      consent = false;
      if (phase !== "live") {
        session = null;
        calibration = null;
        phase = "idle";
      }
      emit();
    },

    clearError() {
      error = null;
      emit();
    },
  };

  snapshot = build();
  return controller;
}
