import { useCallback, useEffect, useRef, useState } from "react";
import { HEAD_RANGE_CALIBRATION, type HeadDirection } from "@/config/coaching";
import { Button } from "./Button";

/**
 * Head-range calibration: the first part of the baseline (PRD §6 Screen B).
 * The person looks centre, up, down, left and right, holding each position
 * briefly. Steps and timing come from HEAD_RANGE_CALIBRATION.
 *
 * Three pieces, so both calibration flows (Setup and /calibrate) share them:
 *  - useHeadRange: drives the timed sequence (pause, resume, restart).
 *  - HeadRangePrompt: the on-screen direction, placed over the camera preview
 *    (WebcamFrame `overlay`) at the edge the person should move toward.
 *  - HeadRangeSteps: the text-side checklist and controls.
 *
 * The preview is mirrored, so "your left" is the left edge of the preview.
 * TODO(cv-team): sample VisionFrame.headPose during each hold to record the
 * person's comfortable range. Until then the sequence is timed only, and the
 * copy never claims a movement was detected.
 */
const { steps: STEPS, holdMs: HOLD_MS } = HEAD_RANGE_CALIBRATION;
const TICK_MS = 100;

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
}

/**
 * Runs the sequence while `active` (the part is open and the camera is live).
 * Going inactive holds the current position rather than skipping it.
 */
export function useHeadRange({ active, onComplete }: { active: boolean; onComplete: () => void }): HeadRange {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const done = index >= STEPS.length;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const running = active && !paused && !done;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (elapsed < HOLD_MS) return;
    setElapsed(0);
    setIndex((i) => i + 1);
  }, [elapsed]);

  useEffect(() => {
    if (done) completeRef.current();
  }, [done]);

  const restart = useCallback(() => {
    setIndex(0);
    setElapsed(0);
    setPaused(false);
  }, []);

  return {
    index: Math.min(index, STEPS.length - 1),
    progress: done ? 1 : Math.min(1, elapsed / HOLD_MS),
    paused,
    done,
    pause: useCallback(() => setPaused(true), []),
    resume: useCallback(() => setPaused(false), []),
    restart,
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
      className={`absolute ${PLACEMENT[step.direction]} w-max rounded border border-border bg-bg/95 px-4 py-3 text-text-primary`}
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

/** Text side: what this part is for, the five positions, and the controls. */
export function HeadRangeSteps({ range, onSkip }: { range: HeadRange; onSkip: () => void }) {
  const step = STEPS[range.index];
  return (
    <div>
      <p className="text-text-muted">
        Follow the directions on your preview and hold each position for a moment. Move only as far as is
        comfortable; small movements are enough.
      </p>

      {/* Announce each new position for screen-reader users. */}
      <p className="sr-only" aria-live="polite">
        {range.paused ? "Paused." : `${step.label}: ${step.instruction}.`}
      </p>

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
              <span className="text-[14.5px] italic">
                {state === "done" ? "held" : state === "current" ? (range.paused ? "paused" : "holding…") : ""}
              </span>
            </li>
          );
        })}
      </ol>

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
        <Button variant="ghost" onClick={onSkip}>
          Skip this part
        </Button>
      </div>
    </div>
  );
}
