/**
 * A single coaching cue, styled as a quiet margin annotation.
 * Owner: Design System team. Discreet, dismissible, nonblocking (CLAUDE.md §6 /
 * PRD §8). Positioning is the screen's responsibility — this is presentation.
 */
export function CueBubble({
  text,
  index,
  onDismiss,
}: {
  text: string;
  index?: number;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 border border-text-primary bg-bg/95 px-[15px] py-[13px]"
    >
      {index != null && (
        <span className="mt-[2px] font-mono text-[11px] text-ochre">
          cue&nbsp;{String(index).padStart(2, "0")}
        </span>
      )}
      <p className="m-0 flex-1 font-serif text-[15.5px] italic text-text-primary">{text}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss cue"
          className="-mr-1 -mt-1 ml-auto rounded px-1 text-text-muted transition-colors duration-cue ease-cue hover:text-text-primary"
        >
          ✕
        </button>
      )}
    </div>
  );
}
