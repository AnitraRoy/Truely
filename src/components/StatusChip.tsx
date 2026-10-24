import type { SessionStatus } from "@/types";

/**
 * Example shared primitive. Owner: Design System team.
 * Conveys status with text (never color alone) — PRD §11 Accessibility.
 */
const LABELS: Record<SessionStatus, string> = {
  calibrating: "Calibrating",
  ready: "Ready",
  observing: "Observing",
  paused: "Paused",
  ended: "Ended",
  tracking_unavailable: "Tracking limited",
};

export function StatusChip({ status }: { status: SessionStatus }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-muted">
      <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
      {LABELS[status]}
    </span>
  );
}
