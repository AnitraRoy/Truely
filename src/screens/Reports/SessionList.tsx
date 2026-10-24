import { Link } from "react-router-dom";
import { GOAL_LABELS } from "@/config/coaching";
import type { SessionSummary } from "@/types";
import { formatDate, formatDuration, formatTime } from "@/components/format";

/**
 * The session register: a real table (date, goal, length, events, cues), ruled
 * like the Ledger. The date cell is the link to that session's report. Counts
 * only, never a score (CLAUDE.md §5). Expects sessions already sorted.
 */
export function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Saved sessions, newest first</caption>
      <thead>
        <tr className="border-b-2 border-text-primary">
          {["Date", "Goal", "Length", "Events", "Cues"].map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`pb-2 font-mono text-[11px] font-normal text-text-muted ${i >= 3 ? "text-right" : ""} ${
                i === 1 || i === 3 ? "hidden sm:table-cell" : ""
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id} className="border-b border-border transition-colors duration-cue ease-cue hover:bg-surface">
            <th scope="row" className="py-4 pr-4 font-normal">
              <Link
                to={`/report/${encodeURIComponent(s.id)}`}
                className="font-display text-[19px] leading-tight underline decoration-border decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                {formatDate(s.startedAt)}
              </Link>
              <span className="block font-mono text-[12px] text-text-muted">{formatTime(s.startedAt)}</span>
            </th>
            <td className="hidden py-4 pr-4 sm:table-cell">{GOAL_LABELS[s.goal]}</td>
            <td className="py-4 pr-4 tabular-nums">{formatDuration(s.durationMs)}</td>
            <td className="hidden py-4 pr-4 text-right tabular-nums sm:table-cell">{s.eventCount}</td>
            <td className="py-4 text-right tabular-nums">{s.cueCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
