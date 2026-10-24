import type { ReactNode } from "react";

/**
 * Small typographic pill with a status dot + text label (never colour alone —
 * CLAUDE.md §3). Owner: Design System team.
 */
export type PillTone = "positive" | "ochre" | "warning" | "muted";

const TEXT: Record<PillTone, string> = {
  positive: "text-positive border-positive",
  ochre: "text-ochre border-ochre",
  warning: "text-warning border-warning",
  muted: "text-text-muted border-border",
};

const DOT: Record<PillTone, string> = {
  positive: "bg-positive",
  ochre: "bg-ochre",
  warning: "bg-warning",
  muted: "bg-text-muted",
};

export function Pill({ children, tone = "positive" }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.06em] uppercase ${TEXT[tone]} border rounded-pill px-[9px] py-[3px]`}
    >
      <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${DOT[tone]}`} />
      {children}
    </span>
  );
}
