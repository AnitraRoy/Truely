import type { ReactNode } from "react";

/**
 * Ruled ledger — the Field Journal's register for structured facts.
 * Owner: Design System team. Compose with <LedgerRow>.
 */
export function Ledger({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border-t border-border ${className}`}>{children}</div>;
}

export function LedgerRow({
  label,
  children,
  meta,
}: {
  label: string;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-baseline gap-5 border-b border-border py-[14px]">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">{label}</span>
      <span className="text-[16px]">{children}</span>
      {meta != null && <span className="font-mono text-[12px] text-text-muted">{meta}</span>}
    </div>
  );
}

/** The emphasized value inside a ledger row. */
export function LedgerValue({ children }: { children: ReactNode }) {
  return <span className="font-display text-[21px] leading-tight">{children}</span>;
}
