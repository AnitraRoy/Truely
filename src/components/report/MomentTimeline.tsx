import { clusterMarkers } from "../videoReview/clusterMarkers";
import { formatClock } from "../videoReview/time";

/**
 * A conversation timeline: one track for the session's length, one marker per
 * timestamped moment. Single series, so one hue (forest) and no legend; what
 * each moment is about is stated in its label and the list beside it, never
 * color (CLAUDE.md §3). Moments too close to tell apart share one marker
 * (the playback bar's `clusterMarkers`), shown slightly larger with a count.
 * Markers are real buttons (28px hit area); the selected one is marked by a
 * ring and size as well as ochre. Owner: Design System team.
 */
export interface TimelineMoment {
  id: string;
  atMs: number;
  label: string;
}

/** Track is narrower than the playback bar, so cluster a little more eagerly. */
const CLUSTER_FRACTION = 0.03;

export function MomentTimeline({
  durationMs,
  moments,
  selectedId,
  onSelect,
}: {
  durationMs: number;
  moments: TimelineMoment[];
  selectedId: string | null;
  onSelect: (m: TimelineMoment) => void;
}) {
  const pct = (ms: number) => (durationMs > 0 ? Math.min(100, Math.max(0, (ms / durationMs) * 100)) : 0);
  const byId = new Map(moments.map((m) => [m.id, m]));
  const clusters = clusterMarkers(
    moments.map((m) => ({ id: m.id, kind: "highlight" as const, atMs: m.atMs, label: m.label })),
    durationMs,
    CLUSTER_FRACTION,
  );
  const ticks = [0, durationMs / 2, durationMs];

  return (
    <div>
      <div className="relative mx-3 h-10">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-pill bg-border" />
        <ol aria-label="Moments on the timeline" className="contents">
          {clusters.map((c) => {
            const members = c.markers.map((m) => byId.get(m.id)!);
            const selected = members.some((m) => m.id === selectedId);
            const many = members.length > 1;
            const label = members.map((m) => `${formatClock(m.atMs)} ${m.label}`).join("; ");
            return (
              <li key={members[0].id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pct(c.atMs)}%` }}>
                <button
                  type="button"
                  onClick={() => onSelect(members.find((m) => m.id !== selectedId && selected) ?? members[0])}
                  aria-pressed={selected}
                  aria-label={many ? `${members.length} moments: ${label}` : label}
                  title={label}
                  className="group grid h-7 w-7 place-items-center rounded-pill"
                >
                  <span
                    aria-hidden
                    className={`grid place-items-center rounded-pill border-2 border-surface bg-accent font-mono text-[9px] leading-none text-on-accent transition-[width,height] duration-cue-fast ease-cue ${
                      selected ? "outline outline-2 outline-offset-1 outline-ochre-mark" : ""
                    } ${many ? "h-[18px] w-[18px]" : selected ? "h-[14px] w-[14px]" : "h-[11px] w-[11px] group-hover:h-[13px] group-hover:w-[13px]"}`}
                  >
                    {many ? members.length : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div aria-hidden className="mx-3 flex justify-between font-mono text-[11.5px] tabular-nums text-text-muted">
        {ticks.map((t, i) => (
          <span key={i}>{formatClock(t)}</span>
        ))}
      </div>
    </div>
  );
}
