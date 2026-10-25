import type { RefObject } from "react";
import { Pill } from "@/components/Pill";
import type { ReviewMarker, VideoReviewData } from "./types";
import type { VideoReviewPlayerActions, VideoReviewPlayerState } from "./useVideoReviewPlayer";
import { PLAYBACK_RATES } from "./useVideoReviewPlayer";
import { PlaybackBar } from "./PlaybackBar";
import { MarkerLegend } from "./MarkerLegend";
import { YouTubePlayer, type YouTubePlayerHandle } from "./YouTubePlayer";
import { formatClock } from "./time";

const SKIP_MS = 10_000;

/**
 * The video review player. Shows the real recording when one exists
 * (`data.videoSrc`); a public YouTube placeholder when that's all the
 * development fixture has (`data.youtubeVideoId`); otherwise an honest
 * "no recording" panel — Cue doesn't record video today, so every real
 * report hits that last path (see `types.ts`). The playback bar, controls,
 * and transcript sync all work the same way regardless of which it is.
 */
export function VideoPlayer({
  data,
  state,
  actions,
  videoRef,
  youtubeRef,
  onMarkerSelect,
}: {
  data: VideoReviewData;
  state: VideoReviewPlayerState;
  actions: VideoReviewPlayerActions;
  videoRef: RefObject<HTMLVideoElement>;
  youtubeRef: RefObject<YouTubePlayerHandle>;
  onMarkerSelect: (marker: ReviewMarker) => void;
}) {
  const isFile = Boolean(data.videoSrc);
  const isYoutube = !isFile && Boolean(data.youtubeVideoId);
  const isPlayable = isFile || isYoutube;

  const requestFullscreen = () => {
    if (isFile) videoRef.current?.requestFullscreen?.();
    else if (isYoutube) youtubeRef.current?.requestFullscreen();
  };

  return (
    <div className="border border-border bg-surface p-3.5">
      <div className="relative aspect-video overflow-hidden border border-border bg-bg">
        {isFile ? (
          <>
            <video
              ref={videoRef}
              src={data.videoSrc}
              playsInline
              className={`h-full w-full object-cover ${data.audioOnly ? "opacity-0" : ""}`}
              aria-label={data.audioOnly ? "Session audio recording" : "Session recording"}
            />
            {data.audioOnly && (
              <p className="absolute inset-0 m-auto flex items-center justify-center bg-sunken px-10 text-center font-serif italic text-text-muted">
                Audio recording, kept on this device. The transcript follows along as it plays.
              </p>
            )}
          </>
        ) : isYoutube ? (
          <YouTubePlayer
            ref={youtubeRef}
            videoId={data.youtubeVideoId!}
            onPlay={() => actions.reportExternalPlayState(true)}
            onPause={() => actions.reportExternalPlayState(false)}
            onDurationKnown={actions.reportKnownDuration}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-10 text-center">
            <p className="font-serif italic text-text-muted">
              No video was recorded for this session. Cue doesn&apos;t capture video or audio while coaching.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
              Playback below is a development preview of event and transcript syncing.
            </p>
          </div>
        )}
        {data.fixture && (
          <div className="absolute left-3 top-3">
            <Pill tone="ochre">Dev fixture</Pill>
          </div>
        )}
      </div>

      <PlaybackBar currentMs={state.currentMs} durationMs={state.durationMs} markers={data.markers} onSeek={actions.seek} onMarkerSelect={onMarkerSelect} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={actions.togglePlay}
          aria-label={state.playing ? "Pause" : "Play"}
          className="flex h-8 w-8 items-center justify-center border border-text-primary text-[13px] transition-colors duration-cue-fast ease-cue hover:bg-text-primary hover:text-bg"
        >
          {state.playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => actions.skip(-SKIP_MS)}
          aria-label="Skip back 10 seconds"
          className="font-mono text-[12px] text-text-muted transition-colors duration-cue-fast ease-cue hover:text-text-primary"
        >
          −10s
        </button>
        <button
          type="button"
          onClick={() => actions.skip(SKIP_MS)}
          aria-label="Skip forward 10 seconds"
          className="font-mono text-[12px] text-text-muted transition-colors duration-cue-fast ease-cue hover:text-text-primary"
        >
          +10s
        </button>

        <span className="font-mono text-[12px] tabular-nums text-text-muted" aria-live="off">
          {formatClock(state.currentMs)} / {formatClock(state.durationMs)}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <label className="flex items-center gap-1.5 font-mono text-[12px] text-text-muted">
            Speed
            <select
              value={state.rate}
              onChange={(e) => actions.setRate(Number(e.target.value))}
              className="border border-border bg-bg px-1.5 py-0.5 font-mono text-[12px] text-text-primary"
            >
              {PLAYBACK_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 font-mono text-[12px] text-text-muted">
            Vol
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.volume}
              onChange={(e) => actions.setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-[3px] w-16 cursor-pointer appearance-none rounded-pill bg-border accent-text-primary"
            />
          </label>

          <button
            type="button"
            disabled={!isPlayable}
            onClick={requestFullscreen}
            aria-label="Fullscreen"
            className="font-mono text-[12px] text-text-muted transition-colors duration-cue-fast ease-cue hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⛶
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <MarkerLegend />
      </div>
    </div>
  );
}
