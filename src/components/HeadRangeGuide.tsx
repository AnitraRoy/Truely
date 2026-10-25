import { useCallback, useEffect, useRef, useState } from "react";
import { HEAD_RANGE_CALIBRATION, type HeadDirection } from "@/config/coaching";
import { Button } from "./Button";
import { isDirectionMet, neutralFrom, type Neutral, type PoseReading } from "./headRangeGate";
import type { HeadRangeTracker } from "./useHeadPose";

/**
 * Head-range calibration: the first part of the baseline (PRD §6 Screen B).
 * The person looks centre, up, down, left and right, holding each position
 * briefly. Steps and timing come from HEAD_RANGE_CALIBRATION.
 *
 * Three pieces, so both calibration flows (Setup and /calibrate) share them:
 *  - useHeadRange: drives the sequence (pause, resume, restart, skip a position).
 *  - HeadRangePrompt: the on-screen direction, placed over the camera preview
 *    (WebcamFrame `overlay`) at the edge the person should move toward.
 *  - HeadRangeSteps: the text-side checklist and controls.
 *
 * Gated mode: when a `tracker` (useHeadPose) is passed and ready, a position's
 * hold only advances while the person's head is actually in it, judged against
 * their own centre pose (headRangeGate). Without a tracker, or if face tracking
 * can't load, it falls back to the original timer and says so. The person can
 * always skip one position or the whole part, so nothing can trap them.
 *
 * The preview is mirrored, so "your left" is the left edge of the preview.
 * What was held is returned to `onComplete` but not stored yet.
 * TODO(cv-team): feed `HeadRangeResult.held` into the personalization baseline.
 */
const { steps: STEPS, holdMs: HOLD_MS, detect: DETECT } = HEAD_RANGE_CALIBRATION;
const TICK_MS = 100;

/** What the sequence measured, in the head-pose proxy's units (not angles). */
export interface HeadRangeResult {
  /** True if at least one position was confirmed by detected movement. */
  gated: boolean;
  neutral: Neutral | null;
  held: Partial<Record<HeadDirection, { yaw: number; pitch: number }>>;
}

export interface HeadRange {
  /** Index of the current position in HEAD_RANGE_CALIBRATION.steps. */
  index: number;
  /** 0..1 of the current hold. */
  progress: number;
  paused: boolean;
  done: boolean;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  /** Move on from the current position without it being detected. */
  skipStep: () => void;
  /**
   * "timed": the original timer, no movement check.
   * "waiting": face tracking is starting; the hold is on hold.
   * "gated": each hold only advances while the movement is detected.
   */
  mode: "timed" | "waiting" | "gated";
  /** Gated: the head is in the requested position right now. */
  detected: boolean;
  /** Gated: no usable face in view. */
  noFace: boolean;
  /** Gated: it has taken a while; suggest a bigger movement or skipping. */
  hint: boolean;
  /** True when face tracking was asked for but couldn't load (timer fallback). */
  trackerUnavailable: boolean;
  /** Live readings for tuning, only populated with `?headdebug=1` in the URL. */
  readout: { dyaw: number; dpitch: number; valid: boolean } | null;
}

const debugEnabled = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("headdebug");

const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Runs the sequence while `active` (the part is open and the camera is live).
 * Going inactive holds the current position rather than skipping it.
 */
export function useHeadRange({
  active,
  onComplete,
  tracker,
}: {
  active: boolean;
  onComplete: (result: HeadRangeResult) => void;
  tracker?: HeadRangeTracker;
}): HeadRange {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [detected, setDetected] = useState(false);
  const [noFace, setNoFace] = useState(false);
  const [hint, setHint] = useState(false);
  const [readout, setReadout] = useState<HeadRange["readout"]>(null);
  const done = index >= STEPS.length;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const mode: HeadRange["mode"] = !tracker
    ? "timed"
    : tracker.status === "ready"
      ? "gated"
      : tracker.status === "unavailable"
        ? "timed"
        : "waiting";

  // Latest values for the interval callback, which must not restart on every sample.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sampleRef = useRef(tracker?.sample ?? null);
  sampleRef.current = tracker?.sample ?? null;
  const indexRef = useRef(index);
  indexRef.current = index;

  const neutralRef = useRef<Neutral | null>(null);
  const holdRef = useRef<PoseReading[]>([]);
  const heldRef = useRef<HeadRangeResult["held"]>({});
  const gatedAnyRef = useRef(false);
  const unmetMsRef = useRef(0);
  const stuckMsRef = useRef(0);

  const resetHold = useCallback(() => {
    holdRef.current = [];
    unmetMsRef.current = 0;
    stuckMsRef.current = 0;
    setElapsed(0);
    setDetected(false);
    setHint(false);
  }, []);

  const running = active && !paused && !done && mode !== "waiting";

  useEffect(() => {
    if (!running) return;
    const debug = debugEnabled();
    const id = window.setInterval(() => {
      if (modeRef.current !== "gated") {
        setElapsed((e) => e + TICK_MS);
        return;
      }
      gatedAnyRef.current = true;
      const step = STEPS[indexRef.current];
      const sample = sampleRef.current;
      const reading: PoseReading | null = sample ? { yaw: sample.yaw, pitch: sample.pitch, valid: sample.valid } : null;
      const neutral = neutralRef.current ?? (step.direction === "center" ? null : DETECT.fallbackNeutral);
      const met = isDirectionMet(step.direction, reading, neutral);

      if (met && reading) {
        unmetMsRef.current = 0;
        stuckMsRef.current = 0;
        holdRef.current = [...holdRef.current, reading].slice(-DETECT.neutralMaxSamples);
        setElapsed((e) => e + TICK_MS);
      } else {
        unmetMsRef.current += TICK_MS;
        stuckMsRef.current += TICK_MS;
        if (unmetMsRef.current > DETECT.graceMs) {
          holdRef.current = [];
          setElapsed(0);
        }
      }
      setDetected(met);
      setNoFace(!reading?.valid);
      setHint(stuckMsRef.current >= DETECT.hintAfterMs);
      if (debug && reading) {
        const base = neutral ?? DETECT.fallbackNeutral;
        setReadout({ dyaw: reading.yaw - base.yaw, dpitch: reading.pitch - base.pitch, valid: reading.valid });
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  // A hold finished: remember what was held, then move to the next position.
  useEffect(() => {
    if (elapsed < HOLD_MS) return;
    const step = STEPS[indexRef.current];
    if (modeRef.current === "gated" && holdRef.current.length > 0) {
      if (step.direction === "center") neutralRef.current = neutralFrom(holdRef.current);
      else {
        const usable = holdRef.current.filter((r) => r.valid);
        if (usable.length) heldRef.current[step.direction] = { yaw: medianOf(usable.map((r) => r.yaw)), pitch: medianOf(usable.map((r) => r.pitch)) };
      }
    }
    resetHold();
    setIndex((i) => i + 1);
  }, [elapsed, resetHold]);

  useEffect(() => {
    if (done) completeRef.current({ gated: gatedAnyRef.current, neutral: neutralRef.current, held: heldRef.current });
  }, [done]);

  const restart = useCallback(() => {
    neutralRef.current = null;
    heldRef.current = {};
    gatedAnyRef.current = false;
    resetHold();
    setIndex(0);
    setPaused(false);
  }, [resetHold]);

  const skipStep = useCallback(() => {
    resetHold();
    setIndex((i) => i + 1);
  }, [resetHold]);

  return {
    index: Math.min(index, STEPS.length - 1),
    progress: done ? 1 : Math.min(1, elapsed / HOLD_MS),
    paused,
    done,
    pause: useCallback(() => setPaused(true), []),
    resume: useCallback(() => setPaused(false), []),
    restart,
    skipStep,
    mode,
    detected: mode === "gated" ? detected : true,
    noFace: mode === "gated" && noFace,
    hint: mode === "gated" && hint,
    trackerUnavailable: tracker?.status === "unavailable",
    readout: debugEnabled() ? readout : null,
  };
}

/** Where the prompt sits on the preview: at the edge the person moves toward. */
const PLACEMENT: Record<HeadDirection, string> = {
  center: "bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)]",
  up: "top-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)]",
  down: "bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)]",
  left: "left-4 top-1/2 -translate-y-1/2 max-w-[38%]",
  right: "right-4 top-1/2 -translate-y-1/2 max-w-[38%]",
};

/** Arrow rotation per direction; the centre position shows a still mark instead. */
const ROTATE: Record<Exclude<HeadDirection, "center">, string> = {
  up: "-rotate-90",
  down: "rotate-90",
  left: "rotate-180",
  right: "",
};

function DirectionMark({ direction }: { direction: HeadDirection }) {
  if (direction === "center") {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`h-6 w-6 shrink-0 ${ROTATE[direction]}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * The direction drawn over the preview. A solid paper label (no blur), small
 * enough to leave the person's face clear, with a hold bar that fills while
 * they hold the position.
 */
export function HeadRangePrompt({ range }: { range: HeadRange }) {
  const step = STEPS[range.index];
  return (
    <div
      className={`absolute ${PLACEMENT[step.direction]} w-max rounded border ${
        range.mode === "gated" && range.detected && !range.paused ? "border-accent" : "border-border"
      } bg-bg/95 px-4 py-3 text-text-primary`}
    >
      <div className="flex items-center gap-3">
        <DirectionMark direction={step.direction} />
        <p className="font-display text-[clamp(17px,2.2vw,22px)] font-semibold leading-tight">
          {range.paused ? "Paused" : step.prompt}
        </p>
      </div>
      <div className="mt-2.5 h-[3px] bg-border" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${range.progress * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * The same direction, drawn inside the floating overlay window instead of on
 * the preview (Calibration screen, desktop shell only — see
 * `useFloatingOverlay.setPosition`). The window itself has already moved to
 * the matching screen position (centre, then each edge); this is just what
 * fills it, styled like SessionOverlay's panel: rounded, slightly
 * translucent, no header or dismiss control since its position is automatic.
 */
export function HeadRangeFloatingTarget({ range }: { range: HeadRange }) {
  const step = STEPS[range.index];
  return (
    <main className="flex h-screen select-none flex-col items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-border bg-bg/90 p-4 text-center">
      <DirectionMark direction={step.direction} />
      <p className="font-display text-[clamp(16px,2.4vw,20px)] font-semibold leading-tight">
        {range.paused ? "Paused" : step.prompt}
      </p>
      <div className="h-[3px] w-full max-w-[140px] bg-border" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${range.progress * 100}%` }} />
      </div>
    </main>
  );
}

/** One plain line saying what the current position is waiting for. */
function statusLine(range: HeadRange): string {
  const step = STEPS[range.index];
  if (range.done) return "";
  if (range.paused) return "Paused.";
  if (range.mode === "waiting") return "Getting face tracking ready…";
  if (range.mode === "gated") {
    if (range.noFace) return "Can't see your face. Check your lighting and stay in frame.";
    if (!range.detected) return `Waiting for you to: ${step.prompt.toLowerCase()}.`;
  }
  return "Holding…";
}

/** Text side: what this part is for, the five positions, and the controls. */
export function HeadRangeSteps({ range, onSkip }: { range: HeadRange; onSkip: () => void }) {
  const step = STEPS[range.index];
  const status = statusLine(range);
  const currentNote = range.paused
    ? "paused"
    : range.mode === "waiting"
      ? "starting…"
      : range.mode === "gated" && !range.detected
        ? "waiting…"
        : "holding…";
  return (
    <div>
      <p className="text-text-muted">
        Follow the directions on your preview and hold each position for a moment. Move only as far as is
        comfortable; small movements are enough.
        {range.mode === "gated" && " Cue waits until it sees each movement before moving on."}
      </p>

      {/* Announce each new position and what it is waiting for, for screen-reader users. */}
      <p className="sr-only" aria-live="polite">
        {`${step.label}: ${step.instruction}. ${status}`}
      </p>

      {range.mode === "gated" && !range.done && (
        <p className="mt-4 text-[14.5px] italic text-text-muted" aria-hidden>
          {status}
        </p>
      )}
      {range.hint && (
        <p className="mt-2 text-[14.5px] text-text-muted">
          Not picking that up yet. Try a slightly bigger movement, or skip this position.
        </p>
      )}
      {range.trackerUnavailable && (
        <p className="mt-4 text-[14.5px] text-text-muted">
          Movement detection isn&apos;t available right now, so each position runs on a timer instead.
        </p>
      )}

      <ol className="mt-6 border-t border-border" aria-label="Head positions">
        {STEPS.map((s, i) => {
          const state = range.done || i < range.index ? "done" : i === range.index ? "current" : "next";
          return (
            <li
              key={s.direction}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-baseline justify-between gap-4 border-b border-border py-2.5 ${
                state === "current" ? "text-text-primary" : "text-text-muted"
              }`}
            >
              <span className={state === "current" ? "font-display text-[18px] font-semibold" : ""}>{s.label}</span>
              <span className="text-[14.5px] italic">{state === "done" ? "held" : state === "current" ? currentNote : ""}</span>
            </li>
          );
        })}
      </ol>

      {range.readout && (
        <p className="mt-3 font-mono text-[12px] text-text-muted" data-testid="head-readout">
          yaw {range.readout.dyaw >= 0 ? "+" : ""}
          {range.readout.dyaw.toFixed(3)} · pitch {range.readout.dpitch >= 0 ? "+" : ""}
          {range.readout.dpitch.toFixed(3)} · face {range.readout.valid ? "ok" : "not usable"}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-6">
        {range.paused ? (
          <Button onClick={range.resume}>Resume</Button>
        ) : (
          <Button variant="ghost" onClick={range.pause}>
            Pause
          </Button>
        )}
        <Button variant="ghost" onClick={range.restart}>
          Start over
        </Button>
        <Button variant="ghost" onClick={range.skipStep} disabled={range.done}>
          Skip this position
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip this part
        </Button>
      </div>
    </div>
  );
}
