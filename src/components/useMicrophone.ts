import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_CHECK } from "@/config/conversation";
import { LevelMeter, SpeechTally, type SpeechSummary } from "@/lib/audio";
import { startSessionRecorder, type SessionRecorder, type SessionRecording } from "./sessionRecorder";

/**
 * Microphone access for voice practice and live transcription. Owner: Design
 * System team. Requested only when the person starts something that needs it
 * (CLAUDE.md §5 / PRD §4.4) and released when the screen unmounts.
 *
 * Also provides `record()` for clips (one answer, one chunk of live audio) and
 * `startFullRecording()` for the session recording (audio, plus video when the
 * screen passes the camera stream). Clips
 * go to transcription; the full recording stays on this device. Each clip also
 * measures how much speech it held (`speech()`), locally, so callers can keep
 * silent clips away from transcription.
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
  /** How much speech the clip held so far. Final once `stop()` resolves. */
  speech: () => SpeechSummary;
}

/** Sample the mic level while a clip records. Never throws: no Web Audio means "not measured". */
function startTally(stream: MediaStream) {
  const tally = new SpeechTally(SPEECH_CHECK.tickMs);
  let meter: LevelMeter | null = null;
  let timer: number | undefined;
  try {
    meter = new LevelMeter(stream);
    void meter.resume().catch(() => undefined);
    const m = meter;
    timer = window.setInterval(() => tally.add(m.read(), m.running), SPEECH_CHECK.tickMs);
  } catch {
    meter = null;
  }
  return {
    summary: () => tally.summary(),
    stop: () => {
      window.clearInterval(timer);
      meter?.close();
      meter = null;
    },
  };
}

export function useMicrophone() {
  const streamRef = useRef<MediaStream | null>(null);
  const fullRef = useRef<SessionRecorder | null>(null);
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
    void fullRef.current?.stop();
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
    const tally = startTally(stream);
    return {
      stop: () =>
        new Promise<Blob>((resolve) => {
          tally.stop();
          if (rec.state === "inactive") return resolve(new Blob(chunks, { type: rec.mimeType }));
          rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
          rec.stop();
        }),
      speech: tally.summary,
    };
  }, []);

  /**
   * Begin the whole-session recording: this microphone (when on) plus the
   * camera's video track (when given). Works with either alone.
   */
  const startFullRecording = useCallback((video?: MediaStream | null) => {
    if (fullRef.current) return true;
    fullRef.current = startSessionRecorder({ audio: streamRef.current, video });
    return fullRef.current != null;
  }, []);

  const stopFullRecording = useCallback(async (): Promise<SessionRecording | null> => {
    const full = fullRef.current;
    fullRef.current = null;
    return full ? full.stop() : null;
  }, []);

  useEffect(
    () => () => {
      void fullRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { state, enable, disable, record, startFullRecording, stopFullRecording };
}
