import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * The journal masthead: the truely. wordmark and an optional right-hand folio line.
 * Pass `homeHref` to make the wordmark a link (never on /session or /calibrate,
 * where leaving should be deliberate). Owner: Design System team. No decorative
 * coded-SVG stamp (CLAUDE.md §4A.3).
 */
export function Masthead({
  folio,
  size = "lg",
  homeHref,
}: {
  folio?: ReactNode;
  size?: "lg" | "sm";
  homeHref?: string;
}) {
  const wordmark = (
    <>
      truely<span className="text-ochre-mark">.</span>
    </>
  );
  const cls = `font-display font-semibold tracking-[-0.01em] ${size === "lg" ? "text-[26px]" : "text-[20px]"}`;
  return (
    <div className="flex items-end justify-between gap-5 border-b-2 border-text-primary pb-3">
      {homeHref ? (
        <Link to={homeHref} className={`${cls} transition-colors duration-cue ease-cue hover:text-accent`} aria-label={homeHref === "/" ? "truely. landing page" : "truely. home"}>
          {wordmark}
        </Link>
      ) : (
        <span className={cls}>{wordmark}</span>
      )}
      {folio && (
        <div className="text-right font-mono text-[11.5px] leading-snug text-text-muted">{folio}</div>
      )}
    </div>
  );
}
