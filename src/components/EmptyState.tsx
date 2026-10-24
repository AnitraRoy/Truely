import type { ReactNode } from "react";

/**
 * Honest empty state: says what will appear here and how to get it. Never a
 * placeholder chart or sample data (CLAUDE.md §5). Owner: Design System team.
 */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-border px-6 py-7">
      <p className="font-display text-[20px] leading-snug">{title}</p>
      {children && <p className="mt-2 max-w-[56ch] font-serif italic text-text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
