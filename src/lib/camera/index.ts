
/**
 * Camera module (PRD §9).
 * Requests webcam access and releases tracks when stopped.
 * Frames are never uploaded by this module.
 */

export type CameraPermission = "prompt" | "granted" | "denied" | "no_device";

export interface CameraController {
  start(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  stop(): void;
  getStream(): MediaStream | null;
  getPermission(): CameraPermission;
}

export function createCameraController(): CameraController {
  let stream: MediaStream | null = null;
  let permission: CameraPermission = "prompt";

  return {
    async start(constraints = { video: true, audio: false }) {
      if (stream?.getVideoTracks().some((track) => track.readyState === "live")) {
        return stream;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        permission = "no_device";
        throw new Error("Camera API unavailable. Use HTTPS or localhost.");
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        permission = "granted";
        return stream;
      } catch (error) {
        stream = null;

        const name = error instanceof DOMException ? error.name : "";

        if (name === "NotAllowedError" || name === "SecurityError") {
          permission = "denied";
        } else if (
          name === "NotFoundError" ||
          name === "OverconstrainedError"
        ) {
          permission = "no_device";
        }

        throw error;
      }
    },

    stop() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    },

    getStream() {
      return stream;
    },

    getPermission() {
      return permission;
    },
  };
}

export { openCamera, releaseStream } from "./cameraController";
export type { CameraErrorCode, CameraResult } from "./cameraController";