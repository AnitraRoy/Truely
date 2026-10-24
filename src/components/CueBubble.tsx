/**
 * A single coaching cue, styled as a quiet margin annotation.
 * Owner: Design System team. Discreet, dismissible, nonblocking (CLAUDE.md §6 /
 * PRD §8). Positioning is the screen's responsibility — this is presentation.
 */
export function CueBubble({
  text,
  index,
  label,
  onDismiss,
  floating = false,
}: {
  text: string;
  index?: number;
  /** Replaces the index marker, e.g. "sample" for showcase cues that aren't observations. */
  label?: string;
  onDismiss?: () => void;
  /**
   * Set inside the floating overlay window (SessionOverlay), which is itself
   * rounded and slightly transparent (electron/main.cjs, FloatingOverlay).
   * Rounds the bubble to match, while staying more opaque than that panel so
   * the cue text stays legible over whatever's underneath.
   */
  floating?: boolean;
}) {
  const marker = label ?? (index != null ? `cue ${String(index).padStart(2, "0")}` : null);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 border border-text-primary bg-bg/95 px-[15px] py-[13px] ${
        floating ? "rounded-lg" : ""
      }`}
    >
      {marker != null && <span className="mt-[2px] font-mono text-[11px] text-ochre">{marker}</span>}
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
