/**
 * Speech in and out through Cartesia, from the page.
 *
 * The main process mints a short-lived, STT/TTS-scoped token
 * (`getCartesiaToken`); the page opens Cartesia with it directly, so audio
 * never passes through the main process and the API key never reaches the
 * renderer. Like the rest of `lib/services`, nothing here throws: failures
 * resolve to { ok: false, error }. Owner: Integration (person 4).
 *
 * Turn-based by design: a recorded answer (or a chunk of live audio) is sent
 * to batch transcription. That is what the current bridge and SDK support
 * reliably; streaming STT can replace `transcribeAudio` later without
 * changing callers.
 */
import { CARTESIA } from "@/config/conversation";
import { getCartesiaToken } from "./index";
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

/** Test hook. */
export function resetVoiceClientForTests(): void {
  cached = null;
}
