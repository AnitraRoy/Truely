import { useCallback, useEffect, useRef, useState } from "react";
import { useCameraPreview, useSession, useSessionController } from "@/lib/sessions/react";
import { GOAL_SIGNALS } from "@/config/coaching";
import type { SessionSnapshot } from "@/lib/sessions";
import type { CameraObservation, CoachingEvent, Session, SignalName } from "@/types";

/** The signals the camera pipeline actually measures (lib/sessions/pipelineSource). */
const MEASURED: SignalName[] = ["head_orientation", "movement_variability"];

/** A goal signal the pipeline measures has no baseline yet (e.g. motion, under an older goal rule). */
const missingBaseline = (s: Pick<SessionSnapshot, "goal" | "baselines">) =>
  GOAL_SIGNALS[s.goal].some((sig) => MEASURED.includes(sig) && !s.baselines.some((b) => b.signal === sig));

/**
 * Camera analysis for any session mode (voice practice, mock interview, live).
 * Owner: Integration. Thin wrapper over the app's one SessionController, which
 * owns the camera stream and runs the MediaPipe pipeline: the screen shows the
 * preview through it and never opens the camera itself (lib/sessions/react).
 *
 * With a behavioral baseline, `start()` runs a full coaching session, so real
 * cues arrive in `cue`. Without one (the head-range setup screen doesn't make
 * one), it first learns the baseline from the session's own frames, about 45 s
 * (config/coaching.ts `calibrationDurationMs`), then starts analysing on its
 * own; `note` says so meanwhile. The baseline is then kept for later sessions
 * (on disk when the person allows saving). Frames never leave the device; only
 * derived cues are kept (`stop()`).
 */
export function useCameraCoaching() {
  const controller = useSessionController();
  const snap = useSession();
  const preview = useCameraPreview();
  const active = useRef(false);
  /** Start analysing as soon as the baseline being learned is ready. */
  const startWhenLearned = useRef(false);

  const start = useCallback(async (): Promise<boolean> => {
    active.current = true;
    const snap0 = controller.getSnapshot();
    // With additional learning off, a baseline that exists is used as it is, even without motion.
    if (!missingBaseline(snap0) || (!snap0.learningEnabled && snap0.hasBaseline)) return controller.startSession();
    if (await controller.startCalibration()) {
      startWhenLearned.current = true;
      return true;
    }
    return controller.startCamera(); // can't learn a baseline: still show and record the camera
  }, [controller]);

  // The latest camera cue stays shown until a newer one replaces it or the
  // person dismisses it; the engine's own cue times out after a few seconds.
  const [shownCue, setShownCue] = useState<CoachingEvent | null>(null);
  useEffect(() => {
    if (snap.activeCue) setShownCue((c) => (c?.id === snap.activeCue!.id ? c : snap.activeCue));
  }, [snap.activeCue]);
  const dismissCue = useCallback(() => {
    controller.dismissCue();
    setShownCue(null);
  }, [controller]);

  useEffect(() => {
    if (snap.phase !== "calibrated" || !startWhenLearned.current || !active.current) return;
    startWhenLearned.current = false;
    void controller.startSession();
  }, [snap.phase, controller]);

  /** The camera's stream, for the session recording. */
  const stream = useCallback(() => controller.getVisionStream(), [controller]);

  /** Turn the camera off or on mid-session. Analysis pauses while it is off. */
  const setVideo = useCallback(
    async (on: boolean) => {
      if (on) {
        await controller.startCamera();
        controller.resume();
      } else {
        controller.pause();
        controller.stopCamera();
      }
    },
    [controller],
  );

  /**
   * End analysis and release the camera. Resolves to the cues it gave, on the
   * clock of a session that began at `sessionStartedAt`, plus its session id.
   */
  const stop = useCallback(
    async (sessionStartedAt: number): Promise<{ observations: CameraObservation[]; sessionId?: string }> => {
      active.current = false;
      startWhenLearned.current = false;
      controller.cancelCalibration();
      const session: Session | null = await controller.end();
      if (!session) return { observations: [] };
      const observations = session.events
        .map((e) => ({ id: e.id, atMs: e.timestamp - sessionStartedAt, signal: e.signal, text: e.cueText }))
        .filter((o) => o.atMs >= 0);
      return { observations, sessionId: session.id };
    },
    [controller],
  );

  // Leaving the screen mid-session always releases the camera.
  useEffect(
    () => () => {
      if (!active.current) return;
      controller.cancelCalibration();
      void controller.end();
    },
    [controller],
  );

  return {
    ...preview,
    start,
    stop,
    stream,
    setVideo,
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    analysing: snap.phase === "live",
    learning: snap.phase === "calibrating",
    /** 0..1 progress of the baseline being learned. */
    learnProgress: snap.calibration?.fraction ?? 0,
    /** Quiet status for the self-view: tracking trouble. Never a judgment. */
    note:
      snap.phase === "calibrating" || snap.phase === "live"
        ? snap.trackingMessage
        : snap.error?.kind === "calibration" && active.current
          ? "Couldn't learn your usual head position. Check your lighting and framing."
          : null,
    cue: shownCue,
    dismissCue,
  };
}

/**
 * The camera side of a practice call (voice coaching, mock interview): opens
 * the camera before the session so the recording can include it, and hands
 * the call room everything it shows about the camera and the recording.
 */
export function usePracticeCamera() {
  const cam = useCameraCoaching();
  const [videoOn, setVideoOn] = useState(true);
  const [recordingVideo, setRecordingVideo] = useState(false);

  /** Open the camera (with analysis when calibrated). Resolves to its stream for the recording, or null. */
  const open = async (): Promise<MediaStream | null> => {
    const stream = (await cam.start()) ? cam.stream() : null;
    setRecordingVideo(Boolean(stream));
    return stream;
  };

  const stageProps = (recording: boolean) => ({
    camera: { videoRef: cam.videoRef, state: cam.state },
    videoOn,
    onToggleVideo: (on: boolean) => {
      setVideoOn(on);
      void cam.setVideo(on);
    },
    trackingMessage: videoOn ? cam.note : null,
    learning: videoOn && cam.learning,
    learnProgress: cam.learnProgress,
    analysing: cam.analysing,
    cue: cam.cue ? { id: cam.cue.id, text: cam.cue.cueText } : null,
    onDismissCue: cam.dismissCue,
    recording,
    recordingVideo: recording && recordingVideo,
  });

  return { open, close: cam.stop, stageProps };
}
