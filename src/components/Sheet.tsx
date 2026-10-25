import type { ElementType, ReactNode } from "react";

/**
 * A raised sheet of paper on the journal desk. Owner: Design System team.
 * Use for a screen's working surface (the practice panel, the report player),
 * not for every group of content — rules and space do most of the separation
 * (CLAUDE.md §4: no card kits). `tone="accent"` is the one forest field a
 * screen may use for its expressive moment.
 */
export function Sheet({
  children,
  as: Tag = "section",
  tone = "paper",
  className = "",
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  tone?: "paper" | "accent";
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  const toneCls = tone === "accent" ? "on-accent bg-accent text-on-accent border-accent" : "bg-surface border-border";
  return (
    <Tag className={`rounded-lg border ${toneCls} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** A section heading inside a sheet or page: one size, so sections read as peers. */
export function SectionTitle({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`font-display text-[21px] font-semibold leading-snug ${className}`}>
      {children}
    </h2>
  );
}
