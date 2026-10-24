import { useRef } from "react";
import type { ReviewMarker, VideoReviewData } from "./types";
import { useVideoReviewPlayer, type PlayerMode } from "./useVideoReviewPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { TranscriptPanel } from "./TranscriptPanel";
import { MARKER_KIND } from "./MarkerLegend";
import { formatClock } from "./time";
import type { YouTubePlayerHandle } from "./YouTubePlayer";

/**
 * Video playback + synced transcript — the report's visual centerpiece when a
 * recording exists. Playback time, the active marker, and the active
 * transcript segment share one clock (`useVideoReviewPlayer`), so selecting
 * an event anywhere — the bar, the moments list, or the transcript — updates
 * everything else.
 */
export function VideoReviewSection({ data }: { data: VideoReviewData }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YouTubePlayerHandle>(null);
  const mode: PlayerMode = data.videoSrc ? "file" : data.youtubeVideoId ? "youtube" : "none";
  const { actions, ...state } = useVideoReviewPlayer({
    mode,
    videoRef,
    youtubeRef,
    durationMs: data.durationMs,
    transcript: data.transcript,
  });

  const onMarkerSelect = (marker: ReviewMarker) => actions.seek(marker.atMs);
  const sortedMarkers = [...data.markers].sort((a, b) => a.atMs - b.atMs);

  return (
    <section>
      <div className="grid gap-6 md:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] md:items-stretch">
        <VideoPlayer data={data} state={state} actions={actions} videoRef={videoRef} youtubeRef={youtubeRef} onMarkerSelect={onMarkerSelect} />
        <TranscriptPanel
          segments={data.transcript}
          activeSegmentId={state.activeSegmentId}
          following={state.following}
          onSelectSegment={actions.selectSegment}
          onResumeFollowing={actions.resumeFollowing}
          onPauseFollowing={actions.pauseFollowing}
          className="md:h-full"
        />
      </div>

      {sortedMarkers.length > 0 && (
        <div className="mt-6">
          <h3 className="font-mono text-[13px] uppercase tracking-[0.06em] text-text-muted">Moments in this recording</h3>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {sortedMarkers.map((m) => {
              const active = m.transcriptSegmentId ? m.transcriptSegmentId === state.activeSegmentId : m.atMs === state.currentMs;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onMarkerSelect(m)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-baseline gap-3 px-1 py-2.5 text-left transition-colors duration-cue-fast ease-cue hover:bg-surface ${
                      active ? "bg-surface" : ""
                    }`}
                  >
                    <span aria-hidden className={`h-[8px] w-[8px] shrink-0 rounded-pill ${MARKER_KIND[m.kind].swatch}`} />
                    <span className="w-14 shrink-0 font-mono text-[12px] tabular-nums text-text-muted">{formatClock(m.atMs)}</span>
                    <span className="font-serif text-[15px]">{m.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
