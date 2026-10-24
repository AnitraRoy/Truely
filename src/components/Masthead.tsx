import type { ReactNode } from "react";

/**
 * The journal masthead: the Cue wordmark and an optional right-hand folio line.
 * Owner: Design System team. No decorative coded-SVG stamp (CLAUDE.md §4A.3).
 */
export function Masthead({ folio, size = "lg" }: { folio?: ReactNode; size?: "lg" | "sm" }) {
  return (
    <div className="flex items-end justify-between gap-5 border-b-2 border-text-primary pb-3">
      <span className={`font-display font-semibold tracking-[-0.01em] ${size === "lg" ? "text-[26px]" : "text-[20px]"}`}>
        Cue<span className="text-ochre">.</span>
      </span>
      {folio && (
        <div className="text-right font-mono text-[11.5px] leading-snug text-text-muted">{folio}</div>
      )}
    </div>
  );
}
