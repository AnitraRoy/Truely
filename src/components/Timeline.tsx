import type { CoachingEvent } from "@/types";

/**
 * Behavioral timeline — a measured strip of recorded events on a time axis
 * (PRD §6 Screen D). Owner: Design System team; built per the `dataviz` method.
 *
 * Event identity is carried by LABEL + SHAPE as well as hue, never colour alone
 * (CLAUDE.md §3/§6). It renders only the entries it is given — no fabricated
 * events (CLAUDE.md §5); an empty session renders an empty axis.
 *
 * TODO(report): lib/reports now builds a richer `Timeline` (`TimelineItem` spans
 * incl. response windows and paused periods). Move this component onto that
 * model when the post-session report is wired; until then it keeps its own
 * point-entry shape below.
 */
export interface TimelineEntry {
  timestamp: number;
  kind: "deviation" | "cue" | "tracking_gap";
  event?: CoachingEvent;
}
const KIND: Record<
  TimelineEntry["kind"],
  { label: string; stem: number; mark: string; swatch: string }
> = {
  deviation: { label: "deviation", stem: 40, mark: "bg-ochre", swatch: "bg-ochre" },
  cue: { label: "cue", stem: 64, mark: "bg-accent", swatch: "bg-accent" },
  tracking_gap: {
    label: "tracking gap",
    stem: 30,
    mark: "bg-transparent border border-dashed border-text-muted",
    swatch: "bg-transparent border border-dashed border-text-muted",
  },
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Timeline({
  startMs,
  durationMs,
  entries,
  selectedIndex = null,
  onSelect,
}: {
  startMs: number;
  durationMs: number;
  entries: TimelineEntry[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const pct = (ts: number) =>
    durationMs > 0 ? Math.min(100, Math.max(0, ((ts - startMs) / durationMs) * 100)) : 0;

  return (
    <div>
      {/* legend — identity is never colour alone */}
      <ul className="mb-4 flex flex-wrap gap-5 font-mono text-[11px] text-text-muted">
        {(Object.keys(KIND) as TimelineEntry["kind"][]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className={`h-[9px] w-[9px] ${KIND[k].swatch}`} />
            {KIND[k].label}
          </li>
        ))}
      </ul>

      <div className="relative border-t border-text-primary pt-0">
        <div className="relative h-[120px]">
          {ticks.map((t) => (
            <div key={t} aria-hidden>
              <span className="absolute top-0 bottom-[22px] w-px bg-border" style={{ left: `${t * 100}%` }} />
              <span
                className="absolute bottom-0 -translate-x-1/2 font-mono text-[10.5px] text-text-muted"
                style={{ left: `${t * 100}%` }}
              >
                {fmt(t * durationMs)}
              </span>
            </div>
          ))}

          {entries.map((e, i) => {
            const k = KIND[e.kind];
            const selected = selectedIndex === i;
            return (
              <button
                type="button"
                key={`${e.timestamp}-${i}`}
                onClick={() => onSelect?.(i)}
                aria-pressed={selected}
                aria-label={`${k.label} at ${fmt(e.timestamp - startMs)}`}
                className="absolute top-0 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-[5px]"
                style={{ left: `${pct(e.timestamp)}%` }}
              >
                <span
                  className={`font-mono text-[10px] text-bg ${e.kind === "tracking_gap" ? "border border-dashed border-text-muted bg-transparent text-text-muted" : e.kind === "deviation" ? "bg-ochre" : "bg-accent"} px-[5px] py-[2px] whitespace-nowrap`}
                >
                  {k.label}
                  {e.event?.signal ? ` · ${e.event.signal.replace(/_/g, " ")}` : ""}
                </span>
                <span
                  className={`w-px ${selected ? "bg-text-primary" : "bg-text-muted"}`}
                  style={{ height: k.stem }}
                />
                <span className={`h-[9px] w-[9px] ${k.mark} ${selected ? "ring-2 ring-text-primary ring-offset-2 ring-offset-bg" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
