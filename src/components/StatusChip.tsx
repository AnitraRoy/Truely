import type { SessionStatus } from "@/types";
import { Pill, type PillTone } from "./Pill";

/**
 * Session status, conveyed with text + a toned dot (never color alone) —
 * CLAUDE.md §3 / PRD §11. Owner: Design System team.
 */
const STATUS: Record<SessionStatus, { label: string; tone: PillTone }> = {
  calibrating: { label: "Calibrating", tone: "ochre" },
  ready: { label: "Ready", tone: "positive" },
  observing: { label: "Observing", tone: "positive" },
  paused: { label: "Paused", tone: "muted" },
  ended: { label: "Ended", tone: "muted" },
  tracking_unavailable: { label: "Tracking limited", tone: "warning" },
};

export function StatusChip({ status }: { status: SessionStatus }) {
  const { label, tone } = STATUS[status];
  return <Pill tone={tone}>{label}</Pill>;
}
