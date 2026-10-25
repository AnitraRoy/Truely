/** User-facing error model shared by the controller and the UI (PRD §18 "polish error states"). */

export type CueErrorKind =
  | "camera_denied"
  | "no_device"
  | "camera_busy"
  | "camera_lost"
  | "vision_init"
  | "calibration"
  | "no_baseline"
  | "storage";

export interface CueError {
  kind: CueErrorKind;
  /** Plain-language message, safe to show directly. */
  message: string;
}

export function classifyCameraError(err: unknown): CueError {
  const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
  const detail = err instanceof Error ? err.message : String(err);

  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)) {
    return {
      kind: "camera_denied",
      message:
        "Camera access is blocked. Click the camera icon in your browser's address bar, allow access for this site, then try again.",
    };
  }
  if (["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(name)) {
    return { kind: "no_device", message: "No camera was found. Connect a webcam and try again." };
  }
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(name)) {
    return {
      kind: "camera_busy",
      message: "Your camera is being used by another app. Close it and try again.",
    };
  }
  return { kind: "vision_init", message: `truely. couldn't start tracking. ${detail}`.trim() };
}
