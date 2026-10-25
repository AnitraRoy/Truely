import { useCallback, useEffect, useRef, useState } from "react";
import { useMicrophone } from "@/components/useMicrophone";
import { LIVE_CONVERSATION } from "@/config/conversation";
import { liveSuggestion } from "@/lib/conversation";
import { transcribeAudio } from "@/lib/services/voice";
import { newId } from "@/state/conversations";
import type { CommunicationProfile, FeedbackEvent, TranscriptSegment } from "@/types";

/**
 * Live conversation listening: the microphone is transcribed in short chunks
 * (Cartesia), and now and then Moss is asked whether one discreet suggestion
 * is worth showing. The default answer is silence: suggestions need several
 * new lines AND a long cooldown since the last one (config/conversation.ts).
 *
 * One microphone can't tell speakers apart, so lines carry no speaker label.
 * Paused means not listening at all.
 */
export function useLiveConversation({
  enabled,
  paused,
  suggest,
  profile,
  goals,
}: {
  enabled: boolean;
  paused: boolean;
  /** Ask for suggestions (needs Moss). Transcription alone still works without it. */
  suggest: boolean;
  profile: CommunicationProfile | null;
  goals: string[];
}) {
  const mic = useMicrophone();
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [suggestion, setSuggestion] = useState<FeedbackEvent | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const startedAt = useRef(0);
  const feedback = useRef<FeedbackEvent[]>([]);
  const lines = useRef<TranscriptSegment[]>([]);
  const sinceSuggestion = useRef(0);
  const lastSuggestionAt = useRef(-Infinity);

  const start = useCallback(
    async (opts: { record: boolean }) => {
      startedAt.current = Date.now();
      if (!enabled) return true;
      const ok = await mic.enable();
      if (ok && opts.record) mic.startFullRecording();
      return ok;
    },
    [enabled, mic],
  );

  const considerSuggestion = useCallback(async () => {
    const now = Date.now() - startedAt.current;
    if (!suggest || sinceSuggestion.current < LIVE_CONVERSATION.minNewSegments) return;
    if (now - lastSuggestionAt.current < LIVE_CONVERSATION.suggestionCooldownMs) return;
    sinceSuggestion.current = 0;
    const s = await liveSuggestion({ profile, goals, transcript: lines.current });
    if (!s) return;
    const seg = lines.current.find((l) => l.id === s.segmentId);
    const event: FeedbackEvent = { id: newId("fb"), atMs: seg?.startMs ?? now, ...s };
    lastSuggestionAt.current = now;
    feedback.current = [...feedback.current, event];
    setSuggestion(event);
  }, [goals, profile, suggest]);

  // The chunk loop: record ~chunkMs, transcribe, repeat, while live and not paused.
  const { record, state: micState } = mic;
  useEffect(() => {
    if (!enabled || paused || micState !== "live") return;
    let stopped = false;
    let timer: number | undefined;
    let current: ReturnType<typeof record> = null;
    const loop = () => {
      if (stopped) return;
      const at = Date.now() - startedAt.current;
      const clip = record();
      current = clip;
      if (!clip) return;
      timer = window.setTimeout(async () => {
        const audio = await clip.stop();
        const endMs = Date.now() - startedAt.current;
        loop(); // start listening again right away, then transcribe what we have
        setTranscribing(true);
        const res = await transcribeAudio(audio);
        setTranscribing(false);
        if (!res.ok) {
          setProblem("Transcription paused: Cue couldn't reach Cartesia. It will keep trying.");
          return;
        }
        setProblem(null);
        if (!res.text) return;
        const seg: TranscriptSegment = { id: newId("seg"), startMs: at, endMs, text: res.text };
        lines.current = [...lines.current, seg];
        sinceSuggestion.current += 1;
        setTranscript(lines.current);
        void considerSuggestion();
      }, LIVE_CONVERSATION.chunkMs);
    };
    loop();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      void current?.stop(); // pausing drops the unfinished chunk: paused means not listening
    };
  }, [enabled, paused, micState, record, considerSuggestion]);

  // A suggestion fades on its own; it never waits for attention.
  useEffect(() => {
    if (!suggestion) return;
    const id = window.setTimeout(() => setSuggestion(null), LIVE_CONVERSATION.suggestionVisibleMs);
    return () => window.clearTimeout(id);
  }, [suggestion]);

  const stop = useCallback(async () => {
    const recording = await mic.stopFullRecording();
    mic.disable();
    return { recording, startedAt: startedAt.current, endedAt: Date.now(), transcript: lines.current, feedback: feedback.current };
  }, [mic]);

  return {
    micState: mic.state,
    transcript,
    transcribing,
    problem,
    suggestion,
    dismissSuggestion: () => setSuggestion(null),
    start,
    stop,
  };
}
