import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TranscriptSegment } from "@/types";
import { formatClock } from "./videoReview/time";

/**
 * A transcript as it unfolds (voice coaching, mock interviews, live
 * conversations). Owner: Design System team. For playback with seeking, see
 * videoReview/TranscriptPanel — both render the same `TranscriptSegment`.
 *
 * role="log" so new lines are announced politely. It follows the newest line
 * until the person scrolls up, then offers a way back instead of yanking the
 * scroll position.
 */
export function LiveTranscript({
  segments,
  pending,
  emptyText = "The transcript appears here as you talk.",
  label = "Transcript",
  className = "",
  maxHeight = "max-h-[420px]",
}: {
  segments: TranscriptSegment[];
  /** Shown as the last line while audio is being transcribed. */
  pending?: ReactNode;
  emptyText?: string;
  label?: string;
  className?: string;
  maxHeight?: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    const el = listRef.current;
    if (following && el) el.scrollTop = el.scrollHeight;
  }, [segments.length, pending, following]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  return (
    <div className={`relative ${className}`}>
      <ol
        ref={listRef}
        role="log"
        aria-label={label}
        onScroll={onScroll}
        tabIndex={0}
        className={`${maxHeight} space-y-4 overflow-y-auto pr-2 focus-visible:outline-offset-4`}
      >
        {segments.length === 0 && !pending && <li className="font-serif italic text-text-muted">{emptyText}</li>}
        {segments.map((s) => (
          <li key={s.id} className="grid grid-cols-[48px_1fr] gap-x-3">
            <span className="pt-[3px] font-mono text-[12px] tabular-nums text-text-muted">{formatClock(s.startMs)}</span>
            <div>
              {s.speaker && <p className={`text-[12.5px] font-medium ${s.role === "you" ? "text-accent" : "text-text-muted"}`}>{s.speaker}</p>}
              <p className="font-serif text-[16px] leading-relaxed">{s.text}</p>
            </div>
          </li>
        ))}
        {pending && (
          <li className="grid grid-cols-[48px_1fr] gap-x-3">
            <span />
            <p className="font-serif text-[15px] italic text-text-muted">{pending}</p>
          </li>
        )}
      </ol>
      {!following && segments.length > 0 && (
        <button
          type="button"
          onClick={() => setFollowing(true)}
          className="absolute bottom-1 right-2 min-h-8 rounded-pill border border-border-strong bg-surface px-3 text-[13px] text-text-primary"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
