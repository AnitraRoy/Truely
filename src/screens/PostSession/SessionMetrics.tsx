import { Ledger, LedgerRow, LedgerValue } from "@/components/Ledger";
import { formatDuration } from "@/components/format";
import type { ReportSummary } from "@/lib/reports";

/**
 * Compact, editorial session facts — counts only, never a score (CLAUDE.md
 * §5). Secondary to the video review above it (brief §3): a ledger, not a
 * row of dashboard cards.
 */
export function SessionMetrics({ summary }: { summary: ReportSummary }) {
  const coverage =
    summary.durationMs > 0 ? Math.max(0, Math.round(100 - (summary.trackingLimitedMs / summary.durationMs) * 100)) : null;

  return (
    <Ledger>
      <LedgerRow label="Duration">
        <LedgerValue>{formatDuration(summary.durationMs)}</LedgerValue>
      </LedgerRow>
      <LedgerRow label="Cue prompts" meta="delivered">
        <LedgerValue>{summary.cuesShown}</LedgerValue>
      </LedgerRow>
      <LedgerRow label="Observations" meta="behavioral deviations detected">
        <LedgerValue>{summary.deviationCount}</LedgerValue>
      </LedgerRow>
      <LedgerRow label="Tracking" meta={coverage == null ? undefined : "of the session"}>
        <LedgerValue>{coverage == null ? "—" : `${coverage}%`}</LedgerValue>
      </LedgerRow>
    </Ledger>
  );
}
