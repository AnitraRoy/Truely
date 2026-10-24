import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import type { TranscriptSegment } from "./types";
import { formatClock } from "./time";

/**
 * The synced transcript panel, inspired by YouTube's transcript list: a
 * scrollable, timestamped column that tracks the active segment during
 * playback but never fights the user for control of the scroll position.
 * Clicking a segment (or its timestamp) seeks the player.
 */
export function TranscriptPanel({
  segments,
  activeSegmentId,
  following,
  onSelectSegment,
  onResumeFollowing,
  onPauseFollowing,
  className = "",
}: {
  segments: TranscriptSegment[];
  activeSegmentId: string | null;
  following: boolean;
  onSelectSegment: (id: string) => void;
  onResumeFollowing: () => void;
  onPauseFollowing: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const ignoreScrollUntilRef = useRef(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  // Follow playback: keep the active segment in view, but only while "following".
  useEffect(() => {
    if (!following || !activeSegmentId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-segment-id="${activeSegmentId}"]`);
    if (!el) return;
    ignoreScrollUntilRef.current = Date.now() + 500;
    el.scrollIntoView?.({ block: "nearest" });
  }, [activeSegmentId, following]);

  const onScroll = () => {
    if (Date.now() < ignoreScrollUntilRef.current) return;
    if (following) onPauseFollowing();
  };

  return (
    <div className={`flex flex-col border border-border bg-surface p-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px]">Transcript</h2>
        {!following && (
          <Button variant="ghost" size="sm" onClick={onResumeFollowing}>
            Follow playback
          </Button>
        )}
      </div>

      <label className="sr-only" htmlFor="transcript-search">
        Search transcript
      </label>
      <input
        id="transcript-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript…"
        className="mt-3 border border-border bg-bg px-2.5 py-1.5 font-serif text-[14px] text-text-primary placeholder:text-text-muted"
      />

      <ul ref={listRef} onScroll={onScroll} className="mt-3 flex-1 space-y-[2px] overflow-y-auto pr-1 md:max-h-[460px]">
        {filtered.length === 0 && (
          <li className="py-6 text-center font-serif italic text-text-muted">No transcript lines match &ldquo;{query}&rdquo;.</li>
        )}
        {filtered.map((seg) => {
          const active = seg.id === activeSegmentId;
          return (
            <li key={seg.id} data-segment-id={seg.id}>
              <button
                type="button"
                onClick={() => onSelectSegment(seg.id)}
                aria-current={active ? "true" : undefined}
                className={`block w-full border-l-2 px-3 py-2 text-left leading-relaxed transition-colors duration-cue-fast ease-cue ${
                  active ? "border-accent bg-bg/70" : "border-transparent hover:border-border hover:bg-bg/40"
                }`}
              >
                <span className={`mr-2 font-mono text-[12px] tabular-nums ${active ? "text-accent" : "text-text-muted"}`}>
                  {formatClock(seg.startMs)}
                </span>
                {seg.speaker && (
                  <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">{seg.speaker}</span>
                )}
                <span className={`font-serif text-[15px] ${active ? "text-text-primary" : "text-text-muted"}`}>{seg.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
