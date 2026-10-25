import { useEffect, useRef, useState } from "react";

/**
 * A small status box shown while truely. learns the person's usual head position
 * and movement from the camera (the behavioral baseline), with its progress,
 * then briefly "Camera cues are on" once analysis starts. Owner: Design System.
 *
 * Status, never a judgment (CLAUDE.md §5): it says what is being measured and
 * what to do (nothing special). Progress is a thin bar plus the number in
 * words, so it never relies on the bar alone.
 */
const DONE_VISIBLE_MS = 5000;

export function LearningNotice({
  learning,
  progress,
  analysing,
  className = "",
}: {
  /** The baseline is being learned now. */
  learning: boolean;
  /** 0..1 */
  progress: number;
  /** Camera analysis is running (shows the brief "on" message after learning). */
  analysing: boolean;
  className?: string;
}) {
  const wasLearning = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (learning) {
      wasLearning.current = true;
      return;
    }
    if (!analysing || !wasLearning.current) return;
    wasLearning.current = false;
    setDone(true);
    const id = window.setTimeout(() => setDone(false), DONE_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [learning, analysing]);

  if (!learning && !done) return null;
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div role="status" aria-live="polite" className={`w-[min(240px,100%)] rounded border border-border-strong bg-bg/95 px-3 py-2.5 ${className}`}>
      {learning ? (
        <>
          <p className="m-0 text-[13.5px] font-medium leading-snug">Learning your usual head position and movement</p>
          <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-text-muted">
            Look and talk as you normally would. Camera cues start at 100%, now {pct}%.
          </p>
          <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-pill bg-sunken">
            <div className="h-full rounded-pill bg-accent transition-[width] duration-cue ease-cue" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <p className="m-0 text-[13.5px] font-medium">Camera cues are on.</p>
      )}
    </div>
  );
}
