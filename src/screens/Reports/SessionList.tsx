import { Link } from "react-router-dom";
import { formatDuration } from "@/components/format";
import { KIND_LABELS, type HistoryEntry } from "@/state/history";

/**
 * The session register: a real table across voice coaching, mock interviews and
 * live coaching. The session cell links to the matching report board. Counts
 * and what's available to review only, never a score (CLAUDE.md §5).
 * Expects entries already sorted.
 */
const DATE = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const TIME = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function available(e: HistoryEntry): string {
  const parts = [e.hasTranscript ? "Transcript" : "", e.hasRecording ? "Recording" : "", e.kind === "live" && !e.hasTranscript ? "Timeline" : ""];
  return parts.filter(Boolean).join(", ") || "Summary";
}

export function SessionList({ entries }: { entries: HistoryEntry[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Sessions, newest first</caption>
      <thead>
        <tr className="border-b-2 border-text-primary">
          {["Date", "Session", "Focus", "To review", "Length"].map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`pb-2 text-[12.5px] font-normal text-text-muted ${i === 4 ? "text-right" : ""} ${i === 2 || i === 3 ? "hidden md:table-cell" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={`${e.kind}-${e.id}`} className="border-b border-border transition-colors duration-cue-fast ease-cue hover:bg-surface">
            <td className="py-4 pr-4 align-top">
              <span className="block text-[14.5px]">{DATE.format(e.startedAt)}</span>
              <span className="font-mono text-[12px] text-text-muted">{TIME.format(e.startedAt)}</span>
            </td>
            <th scope="row" className="py-4 pr-4 align-top font-normal">
              <Link
                to={e.href}
                className="font-display text-[18.5px] font-semibold leading-tight underline decoration-border-strong decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                {e.title}
              </Link>
              {e.title !== KIND_LABELS[e.kind] && <span className="block text-[13.5px] text-text-muted">{KIND_LABELS[e.kind]}</span>}
              {e.sample && <span className="block text-[13px] text-ochre">Development sample</span>}
            </th>
            <td className="hidden py-4 pr-4 align-top text-text-muted md:table-cell">{e.focus || "—"}</td>
            <td className="hidden py-4 pr-4 align-top text-[14px] text-text-muted md:table-cell">{available(e)}</td>
            <td className="py-4 text-right align-top font-mono text-[13px] tabular-nums">{formatDuration(e.durationMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
