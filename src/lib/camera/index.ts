/**
 * camera module (PRD §9)
 * Owner: Computer-Vision team.
 *
 * Responsibilities:
 *  - Request webcam permission through a clear user action.
 *  - Start / stop the camera and manage the MediaStream.
 *  - Handle permission failures & missing devices gracefully.
 *  - Release camera tracks when the session ends.
 *
 * Must NOT: upload frames anywhere (PRD §4.4 privacy-by-default).
 */

export type CameraPermission = "prompt" | "granted" | "denied" | "no_device";

export interface CameraController {
  /** Prompt + acquire a stream. Resolves with the stream or throws. */
  start(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  /** Stop all tracks and release the device. */
  stop(): void;
  getStream(): MediaStream | null;
  getPermission(): CameraPermission;
}

// TODO(cv-team): implement with navigator.mediaDevices.getUserMedia.
export function createCameraController(): CameraController {
  throw new Error("camera.createCameraController not implemented");
}
