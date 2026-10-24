import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";

/**
 * Thin wrapper around the YouTube IFrame Player API. Used only to show a
 * public placeholder recording in the development fixture (`fixtures.ts`) —
 * Cue doesn't record real video, so there's nothing else to embed here. The
 * imperative surface mirrors the native `<video>` path closely enough that
 * `useVideoReviewPlayer` can drive either one the same way.
 */
interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
interface YTApi {
  Player: new (
    el: string | HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: { target: YTPlayerInstance }) => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<YTApi> | null = null;
function loadYouTubeApi(): Promise<YTApi> {
  if (window.YT) return Promise.resolve(window.YT);
  if (!apiLoadPromise) {
    apiLoadPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return apiLoadPromise;
}

export interface YouTubePlayerHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  setPlaybackRate(rate: number): void;
  setVolume(volume01: number): void;
  getCurrentTime(): number;
  requestFullscreen(): void;
}

export const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  {
    videoId: string;
    onPlay: () => void;
    onPause: () => void;
    onDurationKnown: (durationMs: number) => void;
  }
>(function YouTubePlayer({ videoId, onPlay, onPause, onDurationKnown }, ref) {
  const containerId = `yt-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(containerId, {
        videoId,
        playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setReady(true);
            const seconds = e.target.getDuration();
            if (seconds > 0) onDurationKnown(seconds * 1000);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) onPlay();
            else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) onPause();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
      setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate(rate),
      setVolume: (volume01) => playerRef.current?.setVolume(Math.round(volume01 * 100)),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      requestFullscreen: () => playerRef.current?.getIframe().requestFullscreen(),
    }),
    [],
  );

  return (
    <div className="absolute inset-0">
      <div id={containerId} className="h-full w-full" />
      {!ready && (
        <p className="absolute inset-0 m-auto flex items-center justify-center px-8 text-center font-serif italic text-text-muted">
          Loading placeholder recording…
        </p>
      )}
    </div>
  );
});
