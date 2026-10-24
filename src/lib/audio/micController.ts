export type MicErrorCode = "mic_denied" | "mic_not_found" | "mic_in_use" | "unknown";

export type MicResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; code: MicErrorCode; message: string };

/** Microphone ONLY. Never use getDisplayMedia / system audio. */
export async function openMicrophone(): Promise<MicResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, code: "unknown", message: "Mic API unavailable (needs https or localhost)." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,  // reduces speaker bleed; not guaranteed against other apps
        noiseSuppression: true,
        autoGainControl: false,  // AGC would flatten loudness and ruin the baseline
      },
      video: false,
    });
    return { ok: true, stream };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError")
      return { ok: false, code: "mic_denied", message: "Microphone permission was denied." };
    if (name === "NotFoundError" || name === "OverconstrainedError")
      return { ok: false, code: "mic_not_found", message: "No microphone found." };
    if (name === "NotReadableError")
      return { ok: false, code: "mic_in_use", message: "Microphone is in use by another app." };
    return { ok: false, code: "unknown", message: String(e) };
  }
}

export function releaseMic(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}