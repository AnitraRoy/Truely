import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { TranscriptSegment } from "./types";
import type { YouTubePlayerHandle } from "./YouTubePlayer";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;

export type PlayerMode = "file" | "youtube" | "none";

export interface VideoReviewPlayerState {
  currentMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  volume: number;
  /** False once the user scrolls the transcript manually; "resume" brings it back. */
  following: boolean;
  activeSegmentId: string | null;
}

export interface VideoReviewPlayerActions {
  togglePlay: () => void;
  seek: (ms: number) => void;
  skip: (deltaMs: number) => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  selectSegment: (id: string) => void;
  resumeFollowing: () => void;
  pauseFollowing: () => void;
  /** Wired to the YouTube placeholder's own play/pause events (`mode: "youtube"`). */
  reportExternalPlayState: (playing: boolean) => void;
  /** Wired to the YouTube placeholder's `onDurationKnown`, once it reports a real duration. */
  reportKnownDuration: (ms: number) => void;
}

const YOUTUBE_POLL_MS = 200;

/**
 * The single source of truth for playback time, play state, and the active
 * transcript segment — shared by the player, the playback bar, the
 * transcript panel, and anything else (markers, key observations) that seeks
 * into the recording. One clock, not three.
 *
 * Drives a real `<video>` element (`mode: "file"`) or the YouTube IFrame API
 * (`mode: "youtube"`, used only for the development placeholder — see
 * `fixtures.ts`); otherwise runs its own clock so the rest of the UI
 * (markers, transcript sync) still works before truely. records any video.
 */
export function useVideoReviewPlayer({
  mode,
  videoRef,
  youtubeRef,
  durationMs: initialDurationMs,
  transcript,
}: {
  mode: PlayerMode;
  videoRef: RefObject<HTMLVideoElement>;
  youtubeRef: RefObject<YouTubePlayerHandle>;
  durationMs: number;
  transcript: TranscriptSegment[];
}): VideoReviewPlayerState & { actions: VideoReviewPlayerActions } {
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(initialDurationMs);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const [volume, setVolume] = useState(1);
  const [following, setFollowing] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => setDurationMs(initialDurationMs), [initialDurationMs]);

  // Simulated clock — only while there's no real (or placeholder) recording.
  useEffect(() => {
    if (mode !== "none" || !playing) return;
    lastTickRef.current = null;
    const tick = (now: number) => {
      const delta = now - (lastTickRef.current ?? now);
      lastTickRef.current = now;
      setCurrentMs((ms) => Math.min(durationMs, ms + delta * rate));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, playing, rate, durationMs]);

  useEffect(() => {
    if (mode === "none" || currentMs < durationMs || durationMs === 0) return;
    setPlaying(false);
  }, [mode, currentMs, durationMs]);

  // Real <video>: mirror its clock and native play/pause state.
  useEffect(() => {
    if (mode !== "file") return;
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setCurrentMs(el.currentTime * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [mode, videoRef]);

  useEffect(() => {
    if (mode === "file" && videoRef.current) videoRef.current.playbackRate = rate;
  }, [mode, rate, videoRef]);
  useEffect(() => {
    if (mode === "file" && videoRef.current) videoRef.current.volume = volume;
  }, [mode, volume, videoRef]);

  // YouTube placeholder: the API has no push time events, so poll while playing.
  useEffect(() => {
    if (mode !== "youtube" || !playing) return;
    const id = window.setInterval(() => {
      const seconds = youtubeRef.current?.getCurrentTime();
      if (seconds != null) setCurrentMs(seconds * 1000);
    }, YOUTUBE_POLL_MS);
    return () => window.clearInterval(id);
  }, [mode, playing, youtubeRef]);

  useEffect(() => {
    if (mode === "youtube") youtubeRef.current?.setPlaybackRate(rate);
  }, [mode, rate, youtubeRef]);
  useEffect(() => {
    if (mode === "youtube") youtubeRef.current?.setVolume(volume);
  }, [mode, volume, youtubeRef]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.min(Math.max(ms, 0), durationMs);
      if (mode === "file" && videoRef.current) videoRef.current.currentTime = clamped / 1000;
      if (mode === "youtube") youtubeRef.current?.seekTo(clamped / 1000);
      setCurrentMs(clamped);
      setFollowing(true);
    },
    [durationMs, mode, videoRef, youtubeRef],
  );

  const togglePlay = useCallback(() => {
    if (mode === "file" && videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play().catch(() => undefined);
      else videoRef.current.pause();
      return;
    }
    if (mode === "youtube") {
      if (playing) youtubeRef.current?.pause();
      else youtubeRef.current?.play();
      return;
    }
    setPlaying((p) => {
      if (!p && currentMs >= durationMs) setCurrentMs(0);
      return !p;
    });
  }, [mode, videoRef, youtubeRef, playing, currentMs, durationMs]);

  const skip = useCallback((deltaMs: number) => seek(currentMs + deltaMs), [seek, currentMs]);

  const selectSegment = useCallback(
    (id: string) => {
      const seg = transcript.find((t) => t.id === id);
      if (seg) seek(seg.startMs);
    },
    [transcript, seek],
  );

  const activeSegmentId = useMemo(() => {
    const active = transcript.find((t) => currentMs >= t.startMs && currentMs < t.endMs);
    return active?.id ?? null;
  }, [transcript, currentMs]);

  return {
    currentMs,
    durationMs,
    playing,
    rate,
    volume,
    following,
    activeSegmentId,
    actions: {
      togglePlay,
      seek,
      skip,
      setRate,
      setVolume: (v: number) => setVolume(Math.min(1, Math.max(0, v))),
      selectSegment,
      resumeFollowing: () => setFollowing(true),
      pauseFollowing: () => setFollowing(false),
      reportExternalPlayState: setPlaying,
      reportKnownDuration: setDurationMs,
    },
  };
}
