import type { ReviewMarkerKind } from "./types";

/** Identity is carried by label + shape as well as hue, never colour alone (CLAUDE.md §3). */
export const MARKER_KIND: Record<ReviewMarkerKind, { label: string; swatch: string }> = {
  cue: { label: "Cue delivered", swatch: "bg-ochre" },
  observation: { label: "Behavioral observation", swatch: "bg-positive" },
  highlight: { label: "Highlighted moment", swatch: "bg-text-primary" },
};

export function MarkerLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-text-muted">
      {(Object.keys(MARKER_KIND) as ReviewMarkerKind[]).map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span aria-hidden className={`h-[8px] w-[8px] rounded-pill ${MARKER_KIND[k].swatch}`} />
          {MARKER_KIND[k].label}
        </li>
      ))}
    </ul>
  );
}
