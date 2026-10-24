import type { TimelineItem, TimelineItemKind } from "@/lib/reports";

/**
 * Behavioral timeline — a measured strip of recorded session events on a
 * time axis (PRD §6 Screen D), built on the richer span model from
 * `lib/reports.buildTimeline` (deviations, cues, the post-cue response
 * window, tracking gaps, paused stretches). Owner: Design System team, per
 * the `dataviz` method.
 *
 * Event identity is carried by LABEL + SHAPE as well as hue, never colour
 * alone (CLAUDE.md §3/§6). It renders only the items it is given — no
 * fabricated events (CLAUDE.md §5); an empty session renders an empty axis.
 */
const KIND: Record<TimelineItemKind, { label: string; swatch: string; bar: string }> = {
  deviation: { label: "deviation", swatch: "bg-ochre", bar: "bg-ochre/70" },
  cue: { label: "cue", swatch: "bg-accent", bar: "bg-accent" },
  response_window: {
    label: "measured after",
    swatch: "border border-dashed border-accent bg-transparent",
    bar: "bg-transparent border-t border-dashed border-accent",
  },
  tracking_gap: {
    label: "tracking gap",
    swatch: "border border-dashed border-text-muted bg-transparent",
    bar: "bg-transparent border-t border-dashed border-text-muted",
  },
  paused: {
    label: "paused",
    swatch: "border border-dotted border-text-muted bg-transparent",
    bar: "bg-transparent border-t border-dotted border-text-muted",
  },
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Timeline({
  durationMs,
  items,
  selectedId = null,
  onSelect,
}: {
  durationMs: number;
  items: TimelineItem[];
  selectedId?: string | null;
  onSelect?: (item: TimelineItem) => void;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const pct = (ms: number) => (durationMs > 0 ? Math.min(100, Math.max(0, (ms / durationMs) * 100)) : 0);
  const present = [...new Set(items.map((i) => i.kind))];

  return (
    <div>
      {/* legend — identity is never colour alone */}
      <ul className="mb-4 flex flex-wrap gap-5 font-mono text-[11px] text-text-muted">
        {(present.length > 0 ? present : (["deviation", "cue", "tracking_gap"] as TimelineItemKind[])).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className={`h-[9px] w-[9px] ${KIND[k].swatch}`} />
            {KIND[k].label}
          </li>
        ))}
      </ul>

      <div className="relative border-t border-text-primary pt-0">
        <div className="relative h-[108px]">
          {ticks.map((t) => (
            <div key={t} aria-hidden>
              <span className="absolute bottom-[22px] top-0 w-px bg-border" style={{ left: `${t * 100}%` }} />
              <span
                className="absolute bottom-0 -translate-x-1/2 font-mono text-[10.5px] text-text-muted"
                style={{ left: `${t * 100}%` }}
              >
                {fmt(t * durationMs)}
              </span>
            </div>
          ))}

          {/* spans: deviations, response windows, tracking gaps, paused stretches */}
          {items
            .filter((i) => i.endMs > i.startMs)
            .map((item) => (
              <div
                key={item.id}
                aria-hidden
                className={`absolute top-[48px] h-[3px] ${KIND[item.kind].bar}`}
                style={{ left: `${pct(item.startMs)}%`, width: `${Math.max(0.6, pct(item.endMs) - pct(item.startMs))}%` }}
              />
            ))}

          {/* points: cues */}
          {items
            .filter((i) => i.endMs === i.startMs)
            .map((item) => {
              const selected = selectedId === item.id;
              const k = KIND[item.kind];
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onSelect?.(item)}
                  aria-pressed={selected}
                  aria-label={`${k.label} at ${fmt(item.startMs)}: ${item.label}`}
                  className="absolute top-0 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-[5px]"
                  style={{ left: `${pct(item.startMs)}%` }}
                >
                  <span className="whitespace-nowrap bg-accent px-[5px] py-[2px] font-mono text-[10px] text-bg">
                    {k.label}
                    {item.signal ? ` · ${item.signal.replace(/_/g, " ")}` : ""}
                    {item.mutedCue ? " · muted" : ""}
                  </span>
                  <span className={`w-px ${selected ? "bg-text-primary" : "bg-text-muted"}`} style={{ height: 40 }} />
                  <span
                    className={`h-[9px] w-[9px] ${k.swatch} ${selected ? "ring-2 ring-text-primary ring-offset-2 ring-offset-bg" : ""}`}
                  />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
