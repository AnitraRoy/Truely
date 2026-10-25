export type CameraErrorCode =
  | "camera_denied"
  | "camera_not_found"
  | "camera_in_use"
  | "unknown";

export type CameraResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; code: CameraErrorCode; message: string };

export async function openCamera(): Promise<CameraResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      code: "unknown",
      message: "Camera API unavailable (needs https or localhost).",
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    return { ok: true, stream };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError")
      return { ok: false, code: "camera_denied", message: "Camera permission was denied." };
    if (name === "NotFoundError" || name === "OverconstrainedError")
      return { ok: false, code: "camera_not_found", message: "No camera found." };
    if (name === "NotReadableError")
      return { ok: false, code: "camera_in_use", message: "Camera is in use by another app." };
    return { ok: false, code: "unknown", message: String(e) };
  }
}

/** Stops every track, which turns the camera light off. Safe to call with null. */
export function releaseStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

