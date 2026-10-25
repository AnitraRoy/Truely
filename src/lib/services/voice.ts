/**
 * Speech in and out through Cartesia, from the page.
 *
 * The main process mints a short-lived, STT/TTS-scoped token
 * (`getCartesiaToken`); the page opens Cartesia with it directly, so audio
 * never passes through the main process and the API key never reaches the
 * renderer. Like the rest of `lib/services`, nothing here throws: failures
 * resolve to { ok: false, error }. Owner: Integration (person 4).
 *
 * `transcribeAudio` stays turn-based: a recorded answer (one clip, sent once
 * it's done) is the right fit for voice coaching and mock interviews.
 * `streamLiveTranscription` is the realtime counterpart, for Live Coaching's
 * transcript: raw PCM goes to Cartesia's STT websocket continuously, and the
 * cumulative text for the turn-in-progress comes back as it's recognized —
 * word by word, not in fixed chunks.
 */
import { CARTESIA } from "@/config/conversation";
import { floatTo16BitPCM } from "@/lib/audio";
import { getCartesiaToken } from "./index";
import { pcmPlayer } from "./playback";
import type { ServiceResult } from "./types";

type CartesiaClient = InstanceType<(typeof import("@cartesia/cartesia-js"))["default"]>;

let cached: { client: CartesiaClient; expiresAt: number } | null = null;

async function client(): Promise<ServiceResult<{ client: CartesiaClient }>> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return { ok: true, client: cached.client };
  const token = await getCartesiaToken();
  if (!token.ok) return token;
  try {
    const { default: Cartesia } = await import("@cartesia/cartesia-js");
    const c = new Cartesia({ token: token.token });
    cached = { client: c, expiresAt: Date.now() + token.expiresInSeconds * 1000 };
    return { ok: true, client: c };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "cartesia_unavailable" };
  }
}

/** File extension Cartesia can sniff from a MediaRecorder mime type. */
function extensionFor(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Transcribe one recorded clip. Empty speech resolves to `text: ""`. */
export async function transcribeAudio(audio: Blob): Promise<ServiceResult<{ text: string }>> {
  if (audio.size === 0) return { ok: true, text: "" };
  const c = await client();
  if (!c.ok) return c;
  try {
    const { toFile } = await import("@cartesia/cartesia-js");
    const file = await toFile(audio, `clip.${extensionFor(audio.type)}`, { type: audio.type || "audio/webm" });
    const res = await c.client.stt.transcribe({ file, model: CARTESIA.sttModel, language: "en" });
    return { ok: true, text: (res.text ?? "").trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "stt_failed" };
  }
}

export interface LiveTranscriptionHandle {
  /** Send one buffer of mic audio (lib/audio.startPcmCapture's `onFrame`). */
  push(samples: Float32Array): void;
  /** Flushes any audio still buffered into a final `onTurnEnd`, then disconnects. */
  close(): void;
}

/**
 * Open a realtime transcription connection: push raw mic audio in as it's
 * captured, and get the current turn's cumulative transcript back as
 * Cartesia recognizes it — several times a second, not once per chunk. Stays
 * open across turns (one call per session, not per utterance).
 */
export async function streamLiveTranscription(opts: {
  /** The capturing AudioContext's rate (lib/audio.startPcmCapture). */
  sampleRate: number;
  onTurnStart?: () => void;
  /** Cumulative text for the turn in progress — replaces, not appends. */
  onTurnUpdate: (text: string) => void;
  /** The turn's final text. */
  onTurnEnd: (text: string) => void;
  onError?: (message: string) => void;
}): Promise<ServiceResult<LiveTranscriptionHandle>> {
  const c = await client();
  if (!c.ok) return c;
  try {
    const ws = c.client.stt.autoFinalize.websocket({
      encoding: "pcm_s16le",
      model: CARTESIA.liveSttModel,
      sample_rate: opts.sampleRate,
    });
    ws.on("event", (event) => {
      if (event.type === "turn.start") opts.onTurnStart?.();
      else if (event.type === "turn.update") opts.onTurnUpdate(event.transcript);
      else if (event.type === "turn.end") opts.onTurnEnd(event.transcript);
      else if (event.type === "error") opts.onError?.(event.message);
    });
    ws.on("error", (err) => opts.onError?.(err.message));
    return {
      ok: true,
      push: (samples) => ws.sendRaw(floatTo16BitPCM(samples)),
      close: () => ws.send({ type: "close" }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "stt_stream_failed" };
  }
}

/** Speak a line of text. Resolves to a playable WAV blob. */
export async function synthesizeSpeech(text: string): Promise<ServiceResult<{ audio: Blob }>> {
  const c = await client();
  if (!c.ok) return c;
  try {
    const res = await c.client.tts.generate({
      model_id: CARTESIA.ttsModel,
      transcript: text,
      voice: CARTESIA.voiceId,
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: CARTESIA.sampleRate },
    });
    return { ok: true, audio: new Blob([await res.arrayBuffer()], { type: "audio/wav" }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "tts_failed" };
  }
}

function decodeF32(base64: string): Float32Array<ArrayBuffer> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer, 0, Math.floor(bytes.length / 4));
}

/**
 * Speak a line as it is generated (Cartesia SSE), so the voice starts within
 * about a second instead of after the whole clip is ready. `onStart` fires as
 * the first audio is scheduled, which is when a screen should show the line.
 * Resolves once playback ends. Fails without sound if nothing could be
 * played (no primed audio, or the stream failed before its first chunk), so
 * the caller can fall back to `synthesizeSpeech`.
 */
export async function speakStreaming(
  text: string,
  opts: { onStart?: () => void; onLevel?: (level: number) => void } = {},
): Promise<ServiceResult<{ started: true }>> {
  const player = pcmPlayer(CARTESIA.sampleRate, opts.onLevel);
  if (!player) return { ok: false, error: "audio_not_primed" };
  const c = await client();
  if (!c.ok) return c;
  let started = false;
  try {
    const stream = await c.client.tts.generateSSE({
      model_id: CARTESIA.ttsModel,
      transcript: text,
      voice: CARTESIA.voiceId,
      output_format: { container: "raw", encoding: "pcm_f32le", sample_rate: CARTESIA.sampleRate },
    });
    for await (const event of stream) {
      if (event.type === "error") throw new Error("tts_stream_error");
      if (event.type !== "chunk") continue;
      player.push(decodeF32(event.data));
      if (!started) {
        started = true;
        opts.onStart?.();
      }
    }
  } catch (err) {
    // Mid-sentence failure: let what was already spoken finish rather than retry the line.
    if (!started) return { ok: false, error: err instanceof Error ? err.message : "tts_failed" };
  }
  await player.finish();
  return started ? { ok: true, started: true } : { ok: false, error: "tts_empty" };
}

/** Test hook. */
export function resetVoiceClientForTests(): void {
  cached = null;
}
