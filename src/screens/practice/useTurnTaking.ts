import { useCallback, useRef, useState } from "react";
import { useMicrophone, type ClipRecorder } from "@/components/useMicrophone";
import { playAudio } from "@/components/useServiceStatus";
import { synthesizeSpeech, transcribeAudio } from "@/lib/services/voice";
import { newId } from "@/state/conversations";
import type { SpeakerRole, TranscriptSegment } from "@/types";

/**
 * Turn-taking for spoken practice (voice coaching, mock interviews): the
 * person records an answer, Cartesia transcribes it, the screen asks the AI
 * for a reply, and Cartesia speaks it. Typing an answer is always possible,
 * and is the path when speech services aren't available.
 *
 * Timestamps are ms from `start()`, shared by the transcript, feedback and the
 * optional recording (one clock).
 */
export type TurnStatus = "idle" | "your-turn" | "listening" | "transcribing" | "thinking" | "speaking" | "ended";

export const TURN_STATUS_LABEL: Record<TurnStatus, string> = {
  idle: "Not started",
  "your-turn": "Your turn",
  listening: "Listening",
  transcribing: "Transcribing",
  thinking: "Thinking",
  speaking: "Speaking",
  ended: "Ended",
};

export function useTurnTaking({ speakerLabel, aiRole, voice }: { speakerLabel: string; aiRole: SpeakerRole; voice: boolean }) {
  const mic = useMicrophone();
  const [status, setStatus] = useState<TurnStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const clip = useRef<{ rec: ClipRecorder; at: number } | null>(null);
  const transcriptRef = useRef<TranscriptSegment[]>([]);

  const now = () => Date.now() - startedAt.current;

  const push = useCallback((seg: TranscriptSegment) => {
    transcriptRef.current = [...transcriptRef.current, seg];
    setTranscript(transcriptRef.current);
    return transcriptRef.current;
  }, []);

  /** Begin the session clock (and the microphone, when speaking). */
  const start = useCallback(
    async (opts: { record?: boolean } = {}) => {
      setError(null);
      if (voice) {
        const ok = await mic.enable();
        if (!ok) return false;
        if (opts.record) mic.startFullRecording();
      }
      startedAt.current = Date.now();
      transcriptRef.current = [];
      setTranscript([]);
      return true;
    },
    [mic, voice],
  );

  /** Add the AI's line to the transcript, and speak it when voice is on. */
  const aiSays = useCallback(
    async (text: string) => {
      const at = now();
      const words = text.split(/\s+/).length;
      push({ id: newId("seg"), startMs: at, endMs: at + words * 380, text, speaker: speakerLabel, role: aiRole });
      if (voice) {
        setStatus("speaking");
        const audio = await synthesizeSpeech(text);
        if (audio.ok) await playAudio(audio.audio);
      }
      setStatus("your-turn");
    },
    [aiRole, push, speakerLabel, voice],
  );

  const beginAnswer = useCallback(() => {
    const rec = mic.record();
    if (!rec) return;
    clip.current = { rec, at: now() };
    setStatus("listening");
  }, [mic]);

  /** Stop recording and transcribe. Resolves to the full transcript, or null if nothing was heard. */
  const finishAnswer = useCallback(async (): Promise<TranscriptSegment[] | null> => {
    const current = clip.current;
    clip.current = null;
    if (!current) return null;
    const audio = await current.rec.stop();
    const endMs = now();
    setStatus("transcribing");
    const res = await transcribeAudio(audio);
    if (!res.ok) {
      setError("Cue couldn't transcribe that answer. Try again, or type it below.");
      setStatus("your-turn");
      return null;
    }
    if (!res.text) {
      setError("Cue didn't catch any speech. Check your microphone, then try again.");
      setStatus("your-turn");
      return null;
    }
    setError(null);
    setStatus("thinking");
    return push({ id: newId("seg"), startMs: current.at, endMs, text: res.text, speaker: "You", role: "you" });
  }, [push]);

  /** A typed answer, for anyone who prefers typing or when speech isn't available. */
  const typedAnswer = useCallback(
    (text: string): TranscriptSegment[] => {
      const at = now();
      setError(null);
      setStatus("thinking");
      return push({ id: newId("seg"), startMs: at, endMs: at + 1000, text: text.trim(), speaker: "You", role: "you" });
    },
    [push],
  );

  /** Stop everything. Resolves to the consented recording, if one was made. */
  const end = useCallback(async () => {
    if (clip.current) await clip.current.rec.stop();
    clip.current = null;
    const recording = await mic.stopFullRecording();
    mic.disable();
    setStatus("ended");
    return { recording, startedAt: startedAt.current, endedAt: Date.now(), transcript: transcriptRef.current };
  }, [mic]);

  return {
    mic: mic.state,
    status,
    setStatus,
    transcript,
    error,
    setError,
    start,
    aiSays,
    beginAnswer,
    finishAnswer,
    typedAnswer,
    end,
    now,
  };
}
