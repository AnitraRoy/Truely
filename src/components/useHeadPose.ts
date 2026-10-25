import { useEffect, useState, type RefObject } from "react";
import { HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import type { HeadPoseSample } from "@/lib/vision";

/**
 * Reads head pose from the live preview so the calibration can tell whether the
 * person actually moved their head. Local only: it samples the same <video> the
 * preview already shows, using the vision module's landmarker, and never touches
 * the stream itself (CLAUDE.md §8: stream handling belongs to the CV team).
 *
 * Status: "idle" (not asked for) -> "loading" (model starting) -> "ready", or
 * "unavailable" when the model can't load in time, so calibration can fall back
 * to its timer instead of blocking the person.
 */
export interface HeadRangeTracker {
  status: "idle" | "loading" | "ready" | "unavailable";
  sample: HeadPoseSample | null;
}

const { pollMs, loadTimeoutMs } = HEAD_RANGE_CALIBRATION.detect;

export function useHeadPose(videoRef: RefObject<HTMLVideoElement | null>, active: boolean): HeadRangeTracker {
  const [state, setState] = useState<HeadRangeTracker>({ status: "idle", sample: null });

  useEffect(() => {
    if (!active) {
      setState({ status: "idle", sample: null });
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let closeLandmarker: (() => void) | undefined;
    setState({ status: "loading", sample: null });

    const giveUp = window.setTimeout(() => {
      if (!cancelled) setState((s) => (s.status === "ready" ? s : { status: "unavailable", sample: null }));
    }, loadTimeoutMs);

    (async () => {
      try {
        const { createLandmarker, detectLandmarks, estimateHeadPose } = await import("@/lib/vision");
        const landmarker = await createLandmarker();
        if (cancelled) {
          landmarker.close();
          return;
        }
        closeLandmarker = () => landmarker.close();
        window.clearTimeout(giveUp);

        let lastTs = 0;
        timer = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.videoWidth === 0) return;
          const ts = performance.now();
          if (ts <= lastTs) return; // MediaPipe needs strictly increasing timestamps
          lastTs = ts;
          try {
            const sample = estimateHeadPose(detectLandmarks(landmarker, video, ts));
            setState({ status: "ready", sample });
          } catch {
            // A single bad frame is not a reason to stop tracking.
          }
        }, pollMs);
        setState({ status: "ready", sample: null });
      } catch {
        if (!cancelled) setState({ status: "unavailable", sample: null });
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      if (timer !== undefined) window.clearInterval(timer);
      closeLandmarker?.();
    };
  }, [active, videoRef]);

  return state;
}
