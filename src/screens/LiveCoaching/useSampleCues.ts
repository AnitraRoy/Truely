import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_CUES, SAMPLE_CUE_TIMING } from "@/config/coaching";

/**
 * Rotates through the sample cues (config/coaching.ts) so the overlay can be
 * shown working before the coaching engine emits real cues. Each sample shows
 * for `visibleMs`, then auto-dismisses, then waits `gapMs` (CLAUDE.md §6).
 * Dismissing ends the current one early. Paused ⇒ nothing shows.
 *
 * `clock` is the window whose timers drive the rotation: pass the floating
 * overlay's window while it's open, since a hidden tab's timers are throttled.
 */
export interface SampleCue {
  id: number;
  text: string;
}

export function useSampleCues({ active, clock = window }: { active: boolean; clock?: Window }) {
  const [cue, setCue] = useState<SampleCue | null>(null);
  const next = useRef(0);
  const [dismissedAt, setDismissedAt] = useState(0);

  useEffect(() => {
    if (!active || SAMPLE_CUES.length === 0) {
      setCue(null);
      return;
    }
    let timer: number;
    const show = () => {
      const id = next.current++;
      setCue({ id, text: SAMPLE_CUES[id % SAMPLE_CUES.length] });
      timer = clock.setTimeout(hide, SAMPLE_CUE_TIMING.visibleMs);
    };
    const hide = () => {
      setCue(null);
      timer = clock.setTimeout(show, SAMPLE_CUE_TIMING.gapMs);
    };
    // First run waits a beat; after a dismissal the normal gap applies.
    timer = clock.setTimeout(show, dismissedAt ? SAMPLE_CUE_TIMING.gapMs : SAMPLE_CUE_TIMING.firstDelayMs);
    return () => clock.clearTimeout(timer);
  }, [active, clock, dismissedAt]);

  const dismiss = useCallback(() => {
    setCue(null);
    setDismissedAt(Date.now());
  }, []);

  return { cue, dismiss };
}
