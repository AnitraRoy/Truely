import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal local webcam preview mirror for the UI (CLAUDE.md §6: the preview is
 * the person's own, framed as a mirror). Local-only: frames never leave the
 * browser (PRD §4.4). This mounts the preview and reflects status; the full
 * camera lifecycle in the CV pipeline belongs to `lib/camera`'s CameraController
 * and this should delegate to it once that module is implemented (CLAUDE.md §8).
 */
export type PreviewState = "off" | "requesting" | "live" | "denied" | "unavailable";

export function useWebcamPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<PreviewState>("off");

  const enable = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setState("live");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, []);

  const disable = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("off");
  }, []);

  // Always release the device when the screen unmounts (PRD §4.4 / §6).
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { videoRef, state, enable, disable };
}
