import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone access for voice practice and live transcription. Owner: Design
 * System team. Requested only when the person starts something that needs it
 * (CLAUDE.md §5 / PRD §4.4) and released when the screen unmounts.
 *
 * Also provides `record()` for clips (one answer, one chunk of live audio) and
 * `startFullRecording()` for the optional, consented session recording. Clips
 * go to transcription; the full recording stays on this device.
 */
export type MicState = "off" | "requesting" | "live" | "denied" | "unavailable";

function classify(err: unknown): MicState {
  const name = err instanceof DOMException ? err.name : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable";
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export interface ClipRecorder {
  stop: () => Promise<Blob>;
}

export function useMicrophone() {
  const streamRef = useRef<MediaStream | null>(null);
  const fullRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; startedAt: number } | null>(null);
  const [state, setState] = useState<MicState>("off");

  const enable = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unavailable");
      return false;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      streamRef.current = stream;
      setState("live");
      return true;
    } catch (err) {
      setState(classify(err));
      return false;
    }
  }, []);

  const disable = useCallback(() => {
    if (fullRef.current?.rec.state === "recording") fullRef.current.rec.stop();
    fullRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("off");
  }, []);

  /** Start recording one clip. Resolves `stop()` to the clip's audio. */
  const record = useCallback((): ClipRecorder | null => {
    const stream = streamRef.current;
    if (!stream) return null;
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.start();
    return {
      stop: () =>
        new Promise<Blob>((resolve) => {
          if (rec.state === "inactive") return resolve(new Blob(chunks, { type: rec.mimeType }));
          rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
          rec.stop();
        }),
    };
  }, []);

  /** Begin the optional whole-session recording (only after explicit consent). */
  const startFullRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || fullRef.current) return false;
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.start(1000);
    fullRef.current = { rec, chunks, startedAt: Date.now() };
    return true;
  }, []);

  const stopFullRecording = useCallback(
    () =>
      new Promise<{ blob: Blob; durationMs: number } | null>((resolve) => {
        const full = fullRef.current;
        fullRef.current = null;
        if (!full) return resolve(null);
        const done = () => resolve({ blob: new Blob(full.chunks, { type: full.rec.mimeType }), durationMs: Date.now() - full.startedAt });
        if (full.rec.state === "inactive") return done();
        full.rec.onstop = done;
        full.rec.stop();
      }),
    [],
  );

  useEffect(
    () => () => {
      if (fullRef.current?.rec.state === "recording") fullRef.current.rec.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { state, enable, disable, record, startFullRecording, stopFullRecording };
}
