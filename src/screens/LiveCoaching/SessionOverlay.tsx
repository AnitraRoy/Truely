import { CueBubble } from "@/components/CueBubble";
import type { SampleCue } from "./useSampleCues";

/**
 * The floating overlay: cues only. It sits over the person's meeting, so it
 * carries no video, no controls, and no status beyond a quiet idle line — the
 * Cue window keeps the preview and the session controls (CLAUDE.md §6).
 *
 * In the desktop shell the window is frameless and fully transparent
 * (electron/main.cjs) and opens top-center, clear of most meeting controls.
 * This panel is what actually draws its shape: a slightly translucent fill,
 * clipped to rounded corners so the transparent window shows through outside
 * them. The top row is the drag handle, and ✕ docks cues back into the Cue
 * window.
 */
const DRAG = "[-webkit-app-region:drag]";
const NO_DRAG = "[-webkit-app-region:no-drag]";

export function SessionOverlay({
  cue,
  paused,
  onDismiss,
  draggable = false,
  onDock,
}: {
  cue: SampleCue | null;
  paused: boolean;
  onDismiss: () => void;
  /** Frameless desktop window: make the top row a drag handle. */
  draggable?: boolean;
  onDock?: () => void;
}) {
  return (
    <main className="flex h-screen select-none flex-col gap-2 overflow-hidden rounded-xl border border-border bg-bg/90 p-2.5">
      <header className={`flex items-center gap-2 ${draggable ? DRAG : ""}`}>
        <span className="font-display text-[14px] font-semibold leading-none">
          Cue<span className="text-ochre">.</span>
        </span>
        {onDock && (
          // Text, not a second ✕: the cue already has its own dismiss control.
          <button
            type="button"
            onClick={onDock}
            aria-label="Show cues in the Cue window instead"
            className={`${NO_DRAG} ml-auto min-h-6 px-1 font-serif text-[13px] italic text-text-muted underline-offset-2 transition-colors duration-cue ease-cue hover:text-text-primary hover:underline`}
          >
            Back to Cue
          </button>
        )}
      </header>

      <div className={`flex flex-1 flex-col justify-center ${NO_DRAG}`}>
        {cue ? (
          <CueBubble key={cue.id} text={cue.text} label="sample" onDismiss={onDismiss} floating />
        ) : (
          <p className="m-0 px-1 font-serif text-[14px] italic text-text-muted">
            {paused ? "Coaching is paused." : "Observing quietly. Cues appear here."}
          </p>
        )}
      </div>
    </main>
  );
}
