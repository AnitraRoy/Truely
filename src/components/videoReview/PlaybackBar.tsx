import { useId, useState } from "react";
import type { ReviewMarker } from "./types";
import { clusterMarkers } from "./clusterMarkers";
import { formatClock } from "./time";
import { MARKER_KIND } from "./MarkerLegend";

/**
 * The seekable playback bar: a native range input (keyboard + screen-reader
 * support for free) with event markers layered on top. Markers that fall too
 * close together to stay legible are clustered (`clusterMarkers`) into one
 * compact mark — never a dense debugging timeline (CLAUDE.md brief).
 */
export function PlaybackBar({
  currentMs,
  durationMs,
  markers,
  onSeek,
  onMarkerSelect,
}: {
  currentMs: number;
  durationMs: number;
  markers: ReviewMarker[];
  onSeek: (ms: number) => void;
  onMarkerSelect: (marker: ReviewMarker) => void;
}) {
  const id = useId();
  const [openTooltip, setOpenTooltip] = useState<number | null>(null);
  const clusters = clusterMarkers(markers, durationMs);
  const pct = (ms: number) => (durationMs > 0 ? Math.min(100, Math.max(0, (ms / durationMs) * 100)) : 0);
  const playedPct = pct(currentMs);

  return (
    <div className="relative pb-1 pt-6">
      <div className="pointer-events-none relative h-5">
        {clusters.map((cluster, i) => {
          const solo = cluster.markers.length === 1 ? cluster.markers[0] : null;
          return (
            <div
              key={cluster.markers[0].id}
              className="pointer-events-auto absolute top-0 -translate-x-1/2"
              style={{ left: `${pct(cluster.atMs)}%` }}
              onMouseEnter={() => setOpenTooltip(i)}
              onMouseLeave={() => setOpenTooltip((h) => (h === i ? null : h))}
            >
              <button
                type="button"
                onClick={() => onMarkerSelect(solo ?? cluster.markers[0])}
                onFocus={() => setOpenTooltip(i)}
                onBlur={() => setOpenTooltip((h) => (h === i ? null : h))}
                aria-label={
                  solo
                    ? `${MARKER_KIND[solo.kind].label} at ${formatClock(solo.atMs)}: ${solo.label}`
                    : `${cluster.markers.length} moments near ${formatClock(cluster.atMs)}`
                }
                className={`block h-[11px] w-[11px] rounded-pill border-2 border-bg transition-transform duration-cue-fast ease-cue hover:scale-125 focus-visible:scale-125 ${
                  solo ? MARKER_KIND[solo.kind].swatch : "bg-text-primary"
                }`}
              />
              {openTooltip === i && (
                <div
                  role="tooltip"
                  className="absolute bottom-[18px] left-1/2 z-10 w-max max-w-[240px] -translate-x-1/2 border border-text-primary bg-bg px-2.5 py-1.5 text-left font-mono text-[11px] leading-snug"
                >
                  {cluster.markers.map((m) => (
                    <p key={m.id} className="m-0 whitespace-nowrap">
                      <span className="text-text-muted">{formatClock(m.atMs)}</span>{" "}
                      <span className="text-text-primary">{m.label}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label htmlFor={id} className="sr-only">
        Seek
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={Math.max(durationMs, 1)}
        step={100}
        value={Math.min(currentMs, durationMs)}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, rgb(var(--cue-text-primary)) ${playedPct}%, rgb(var(--cue-border)) ${playedPct}%)`,
        }}
        className="h-[3px] w-full cursor-pointer appearance-none rounded-pill
          [&::-webkit-slider-thumb]:h-[13px] [&::-webkit-slider-thumb]:w-[13px] [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg
          [&::-webkit-slider-thumb]:bg-text-primary [&::-moz-range-thumb]:h-[13px] [&::-moz-range-thumb]:w-[13px]
          [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-bg
          [&::-moz-range-thumb]:bg-text-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent"
      />
    </div>
  );
}
