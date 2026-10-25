import { useCallback, useRef, useState } from "react";
import { useMicrophone, type ClipRecorder } from "@/components/useMicrophone";
import { PRACTICE_CALL, SPEECH_CHECK } from "@/config/conversation";
import { isSilentClip } from "@/lib/audio";
import { playAudio, primeAudio } from "@/components/useServiceStatus";
import { speakStreaming, synthesizeSpeech, transcribeAudio } from "@/lib/services/voice";
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
 *
 * Whether speech is on is fixed when the session starts (`start({ voice })`)
 * and held in a ref: screens call `start` in the same tick as the state change
 * that turns voice on, before a re-render could hand them a fresh closure.
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
  const [recording, setRecording] = useState(false);
  const startedAt = useRef(0);
  const clip = useRef<{ rec: ClipRecorder; at: number } | null>(null);
  const transcriptRef = useRef<TranscriptSegment[]>([]);
  const voiceRef = useRef(voice);
  /** Loudness of the AI's voice while it speaks (0..1), for the speaker tile. */
  const aiLevel = useRef(0);

  const now = () => Date.now() - startedAt.current;

  const push = useCallback((seg: TranscriptSegment) => {
    transcriptRef.current = [...transcriptRef.current, seg];
    setTranscript(transcriptRef.current);
    return transcriptRef.current;
  }, []);

  /** Begin the session clock (and the microphone, when speaking). */
  const start = useCallback(
    async (opts: { record?: boolean; voice?: boolean; video?: MediaStream | null } = {}) => {
      setError(null);
      voiceRef.current = opts.voice ?? voice;
      if (voiceRef.current) {
        primeAudio();
        const ok = await mic.enable();
        if (!ok) return false;
      }
      // Audio from the microphone (when speaking) and video from the camera (when on).
      setRecording(opts.record ? mic.startFullRecording(opts.video) : false);
      startedAt.current = Date.now();
      transcriptRef.current = [];
      setTranscript([]);
      return true;
    },
    [mic, voice],
  );

  /**
   * Add the AI's line to the transcript and, when voice is on, speak it. The
   * line appears (as a caption) the moment its voice starts: streamed speech
   * shows it on the first audio chunk; the whole-clip fallback once the clip is
   * ready. Without voice it appears at once.
   */
  const aiSays = useCallback(
    async (text: string) => {
      let shown = false;
      const show = () => {
        if (shown) return;
        shown = true;
        const at = now();
        const words = text.split(/\s+/).length;
        push({ id: newId("seg"), startMs: at, endMs: at + words * 380, text, speaker: speakerLabel, role: aiRole });
        if (voiceRef.current) setStatus("speaking");
      };
      if (voiceRef.current) {
        const onLevel = (level: number) => (aiLevel.current = level);
        const streamed = await speakStreaming(text, { onStart: show, onLevel });
        if (!streamed.ok && !shown) {
          const audio = await synthesizeSpeech(text);
          show();
          if (audio.ok) await playAudio(audio.audio, onLevel);
        }
      }
      show();
      setStatus("your-turn");
    },
    [aiRole, push, speakerLabel],
  );

  const beginAnswer = useCallback(() => {
    primeAudio();
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
    if (isSilentClip(current.rec.speech(), SPEECH_CHECK.minVoicedMs)) {
      setError(`Cue didn't hear anything in that answer, so it wasn't sent. Press ${PRACTICE_CALL.answerKeyLabel} and try again.`);
      setStatus("your-turn");
      return null;
    }
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
    const saved = await mic.stopFullRecording();
    mic.disable();
    setRecording(false);
    setStatus("ended");
    return { recording: saved, startedAt: startedAt.current, endedAt: Date.now(), transcript: transcriptRef.current };
  }, [mic]);

  return {
    mic: mic.state,
    /** The session recording is running. */
    recording,
    aiLevel,
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
