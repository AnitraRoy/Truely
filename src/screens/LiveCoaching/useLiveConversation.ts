import { useCallback, useEffect, useRef, useState } from "react";
import { useMicrophone } from "@/components/useMicrophone";
import { LIVE_CONVERSATION } from "@/config/conversation";
import { startPcmCapture, type PcmCapture } from "@/lib/audio";
import { liveSuggestion } from "@/lib/conversation";
import { streamLiveTranscription, type LiveTranscriptionHandle } from "@/lib/services/voice";
import { newId } from "@/state/conversations";
import type { CommunicationProfile, FeedbackEvent, TranscriptSegment } from "@/types";

/**
 * Live conversation listening: the microphone streams continuously to
 * Cartesia's realtime STT websocket, so the transcript grows word by word as
 * each turn is recognized, not in fixed-length batches. Now and then Moss is
 * asked whether one discreet suggestion is worth showing. The default answer
 * is silence: suggestions need several new lines AND a long cooldown since
 * the last one (config/conversation.ts).
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
  context,
}: {
  enabled: boolean;
  paused: boolean;
  /** Ask for suggestions (needs Moss). Transcription alone still works without it. */
  suggest: boolean;
  profile: CommunicationProfile | null;
  goals: string[];
  /** What the conversation is, in the person's words. Helps the suggestions fit. */
  context?: string;
}) {
  const mic = useMicrophone();
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [suggestion, setSuggestion] = useState<FeedbackEvent | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const startedAt = useRef(0);
  const feedback = useRef<FeedbackEvent[]>([]);
  // Finalized lines only; the turn in progress lives in `liveSegment` until it ends.
  const lines = useRef<TranscriptSegment[]>([]);
  const liveSegment = useRef<TranscriptSegment | null>(null);
  const sinceSuggestion = useRef(0);
  const lastSuggestionAt = useRef(-Infinity);

  const start = useCallback(
    async (opts: { record: boolean; video?: MediaStream | null }) => {
      startedAt.current = Date.now();
      const ok = enabled ? await mic.enable() : true;
      // With the microphone off, the recording is the camera alone.
      if (ok && opts.record) mic.startFullRecording(opts.video);
      return ok;
    },
    [enabled, mic],
  );

  const considerSuggestion = useCallback(async () => {
    const now = Date.now() - startedAt.current;
    if (!suggest || sinceSuggestion.current < LIVE_CONVERSATION.minNewSegments) return;
    if (now - lastSuggestionAt.current < LIVE_CONVERSATION.suggestionCooldownMs) return;
    sinceSuggestion.current = 0;
    const s = await liveSuggestion({ profile, goals, context, transcript: lines.current, previous: feedback.current.map((f) => f.title) });
    if (!s) return;
    const seg = lines.current.find((l) => l.id === s.segmentId);
    const event: FeedbackEvent = { id: newId("fb"), atMs: seg?.startMs ?? now, ...s };
    lastSuggestionAt.current = now;
    feedback.current = [...feedback.current, event];
    setSuggestion(event);
  }, [context, goals, profile, suggest]);

  const publish = useCallback(() => {
    setTranscript(liveSegment.current ? [...lines.current, liveSegment.current] : lines.current);
  }, []);

  // The streaming connection: mic audio goes straight to Cartesia as it's
  // captured, and the current turn's cumulative text comes back live.
  const { stream: micStream, state: micState } = mic;
  useEffect(() => {
    if (!enabled || paused || micState !== "live") return;
    const stream = micStream();
    if (!stream) return;

    let cancelled = false;
    let capture: PcmCapture | null = null;
    let handle: LiveTranscriptionHandle | null = null;

    void (async () => {
      const cap = startPcmCapture(stream, (samples) => handle?.push(samples));
      capture = cap;
      const res = await streamLiveTranscription({
        sampleRate: cap.sampleRate,
        onTurnStart: () => {
          const at = Date.now() - startedAt.current;
          liveSegment.current = { id: newId("seg"), startMs: at, endMs: at, text: "" };
          publish();
        },
        onTurnUpdate: (text) => {
          if (!liveSegment.current) return;
          liveSegment.current = { ...liveSegment.current, text, endMs: Date.now() - startedAt.current };
          publish();
        },
        onTurnEnd: (text) => {
          const at = Date.now() - startedAt.current;
          const seg = liveSegment.current ?? { id: newId("seg"), startMs: at, endMs: at, text: "" };
          liveSegment.current = null;
          if (text.trim()) {
            lines.current = [...lines.current, { ...seg, text, endMs: at }];
            sinceSuggestion.current += 1;
            void considerSuggestion();
          }
          publish();
        },
        onError: () => setProblem("Transcription paused: truely. couldn't reach Cartesia. It will keep trying."),
      });
      if (cancelled) {
        cap.stop();
        return;
      }
      if (!res.ok) {
        setProblem("Transcription paused: truely. couldn't reach Cartesia. It will keep trying.");
        cap.stop();
        return;
      }
      setProblem(null);
      handle = res;
    })();

    return () => {
      cancelled = true;
      capture?.stop();
      handle?.close();
      liveSegment.current = null;
    };
  }, [enabled, paused, micState, micStream, considerSuggestion, publish]);

  // A suggestion stays until a newer one replaces it or the person dismisses it.

  const stop = useCallback(async () => {
    const recording = await mic.stopFullRecording();
    mic.disable();
    return { recording, startedAt: startedAt.current, endedAt: Date.now(), transcript: lines.current, feedback: feedback.current };
  }, [mic]);

  return {
    micState: mic.state,
    transcript,
    // Kept for callers built against the old chunked loop; streaming has no separate "processing" state.
    transcribing: false,
    problem,
    suggestion,
    dismissSuggestion: () => setSuggestion(null),
    start,
    stop,
  };
}
