import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal local webcam preview mirror for the UI (CLAUDE.md §6: the preview is
 * the person's own, framed as a mirror). Local-only: frames never leave the
 * browser (PRD §4.4). This mounts the preview and reflects status; the full
 * camera lifecycle in the CV pipeline belongs to `lib/camera`'s CameraController
 * and this should delegate to it once that module is implemented (CLAUDE.md §8).
 *
 * "busy" means another app (usually the meeting app) holds the camera. On
 * Windows most webcams serve one app at a time unless the person turns on
 * multi-app camera sharing (see <CameraBusyHelp>). While busy, the hook retries
 * quietly on a timer, when the window regains focus, and when devices change,
 * and it goes back to busy if another app takes the camera mid-session.
 */
export type PreviewState = "off" | "requesting" | "live" | "denied" | "busy" | "unavailable";

/** How often to retry a busy camera (ms). */
export const CAMERA_BUSY_RETRY_MS = 4000;

function classify(err: unknown): PreviewState {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  // Chromium reports a camera held by another app as NotReadableError
  // ("Could not start video source"), sometimes AbortError (start timed out).
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unavailable";
}

export function useWebcamPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** The screen wants the camera on (enable called, disable/unmount not yet). */
  const wantedRef = useRef(false);
  const inFlightRef = useRef(false);
  const [state, setState] = useState<PreviewState>("off");

  const open = useCallback(async (quiet: boolean) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    if (inFlightRef.current || streamRef.current) return;
    inFlightRef.current = true;
    if (!quiet) setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      // Turned off (or left the screen) while the request was pending.
      if (!wantedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      // Another app taking the camera ends our track: wait for it to free up.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (streamRef.current !== stream) return;
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        if (wantedRef.current) setState("busy");
      });
      setState("live");
    } catch (err) {
      if (wantedRef.current) setState(classify(err));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const enable = useCallback(async () => {
    wantedRef.current = true;
    await open(false);
  }, [open]);

  const disable = useCallback(() => {
    wantedRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("off");
  }, []);

  // Busy: keep trying quietly until the other app lets go (or sharing is turned on).
  useEffect(() => {
    if (state !== "busy") return;
    const retry = () => void open(true);
    const id = window.setInterval(retry, CAMERA_BUSY_RETRY_MS);
    window.addEventListener("focus", retry);
    navigator.mediaDevices?.addEventListener?.("devicechange", retry);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", retry);
      navigator.mediaDevices?.removeEventListener?.("devicechange", retry);
    };
  }, [state, open]);

  // Always release the device when the screen unmounts (PRD §4.4 / §6).
  useEffect(
    () => () => {
      wantedRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { videoRef, state, enable, disable };
}
