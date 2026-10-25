import { useCallback, useRef, useState } from "react";
import { useMicrophone, type ClipRecorder } from "@/components/useMicrophone";
import { PRACTICE_CALL, SPEECH_CHECK } from "@/config/conversation";
import { isSilentClip, startPcmCapture, type PcmCapture } from "@/lib/audio";
import { playAudio, primeAudio } from "@/components/useServiceStatus";
import { speakStreaming, streamLiveTranscription, synthesizeSpeech, transcribeAudio, type LiveTranscriptionHandle } from "@/lib/services/voice";
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

interface LiveText {
  capture: PcmCapture | null;
  handle: LiveTranscriptionHandle | null;
  closed: boolean;
}

export function useTurnTaking({
  speakerLabel,
  aiRole,
  voice,
  onAnswerProgress,
}: {
  speakerLabel: string;
  aiRole: SpeakerRole;
  voice: boolean;
  /**
   * The answer so far, while it's being spoken (Cartesia realtime STT), with ms
   * since the answer began. Lets a screen cue as soon as an issue shows up.
   * Best effort: if streaming can't start, answers still work as before.
   */
  onAnswerProgress?: (text: string, elapsedMs: number) => void;
}) {
  const mic = useMicrophone();
  const progressRef = useRef(onAnswerProgress);
  progressRef.current = onAnswerProgress;
  const live = useRef<LiveText | null>(null);
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

  /** Stream the answer to realtime STT while it's spoken, for mid-answer cues. */
  const startLiveText = useCallback(() => {
    const stream = mic.stream();
    if (!stream || !progressRef.current) return;
    const begun = Date.now();
    const state: LiveText = { capture: null, handle: null, closed: false };
    live.current = state;
    let done = ""; // finished turns of this answer (the STT splits on pauses)
    const report = (current: string) => progressRef.current?.(`${done} ${current}`.trim(), Date.now() - begun);
    void (async () => {
      const capture = startPcmCapture(stream, (samples) => state.handle?.push(samples));
      state.capture = capture;
      const res = await streamLiveTranscription({
        sampleRate: capture.sampleRate,
        onTurnUpdate: (text) => report(text),
        onTurnEnd: (text) => {
          done = `${done} ${text}`.trim();
          report("");
        },
      });
      if (state.closed || !res.ok) {
        capture.stop();
        if (res.ok) res.close();
        return;
      }
      state.handle = res;
    })();
  }, [mic]);

  const stopLiveText = useCallback(() => {
    const state = live.current;
    live.current = null;
    if (!state) return;
    state.closed = true;
    state.capture?.stop();
    state.handle?.close();
  }, []);

  const beginAnswer = useCallback(() => {
    primeAudio();
    const rec = mic.record();
    if (!rec) return;
    clip.current = { rec, at: now() };
    setStatus("listening");
    startLiveText();
  }, [mic, startLiveText]);

  /** Stop recording and transcribe. Resolves to the full transcript, or null if nothing was heard. */
  const finishAnswer = useCallback(async (): Promise<TranscriptSegment[] | null> => {
    const current = clip.current;
    clip.current = null;
    if (!current) return null;
    stopLiveText();
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
  }, [push, stopLiveText]);

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
    stopLiveText();
    if (clip.current) await clip.current.rec.stop();
    clip.current = null;
    const saved = await mic.stopFullRecording();
    mic.disable();
    setRecording(false);
    setStatus("ended");
    return { recording: saved, startedAt: startedAt.current, endedAt: Date.now(), transcript: transcriptRef.current };
  }, [mic, stopLiveText]);

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
