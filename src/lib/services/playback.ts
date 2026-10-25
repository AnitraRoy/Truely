/**
 * Audio playback for spoken practice: one shared AudioContext, whole clips, and
 * streamed PCM chunks scheduled back to back. Owner: Integration (person 4).
 *
 * Browsers only start sound after a gesture, and a reply often arrives seconds
 * after the click, so screens call `primeAudio()` from the click or key
 * handler that starts the exchange. `onLevel` reports playback loudness (0..1)
 * about once a frame, for a "who is talking" cue; it gets 0 when sound ends.
 */
let ctx: AudioContext | null = null;

/** How long past the scheduled end of playback to keep waiting before giving up on "ended". */
const STALL_GRACE_MS = 1500;

export function primeAudio(): void {
  if (typeof AudioContext === "undefined") return;
  ctx ??= new AudioContext();
  void ctx.resume().catch(() => undefined);
}

export function audioContext(): AudioContext | null {
  return ctx;
}

/** An analyser wired to the speakers, plus a loop that reports its level. */
function meter(c: AudioContext, onLevel?: (level: number) => void) {
  const analyser = c.createAnalyser();
  analyser.fftSize = 512;
  analyser.connect(c.destination);
  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const v of samples) sum += ((v - 128) / 128) ** 2;
    onLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 4));
    frame = requestAnimationFrame(tick);
  };
  return {
    input: analyser,
    start: () => {
      if (onLevel && !frame) frame = requestAnimationFrame(tick);
    },
    stop: () => {
      cancelAnimationFrame(frame);
      onLevel?.(0);
    },
  };
}

/** Play a short audio blob; resolves when it ends (or fails). */
export async function playAudio(blob: Blob, onLevel?: (level: number) => void): Promise<void> {
  if (ctx) {
    try {
      const c = ctx;
      const buffer = await c.decodeAudioData(await blob.arrayBuffer());
      const m = meter(c, onLevel);
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(m.input);
      await new Promise<void>((resolve) => {
        const done = () => {
          window.clearTimeout(guard);
          m.stop();
          resolve();
        };
        // If the device stalls (context suspended), stop waiting shortly after the clip's length.
        const guard = window.setTimeout(done, buffer.duration * 1000 + STALL_GRACE_MS);
        source.onended = done;
        source.start();
        m.start();
      });
      return;
    } catch {
      /* fall through to a plain element */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const done = () => {
      URL.revokeObjectURL(url);
      onLevel?.(0);
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

/**
 * Play mono float32 PCM chunks as they arrive, gaplessly. `push` each chunk;
 * `finish` resolves once the last scheduled chunk has played.
 */
export function pcmPlayer(sampleRate: number, onLevel?: (level: number) => void) {
  const c = ctx;
  if (!c) return null;
  const m = meter(c, onLevel);
  // A little lead so the first chunks don't underrun while the next ones decode.
  let at = c.currentTime + 0.08;
  // Count chunks still playing. A chunk can finish before the stream does
  // (network slower than speech), so "done" is "nothing left playing", not the
  // last chunk's ended event, which may already have fired.
  let playing = 0;
  let onIdle: (() => void) | null = null;
  return {
    push(samples: Float32Array<ArrayBuffer>) {
      if (samples.length === 0) return;
      const buffer = c.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(m.input);
      at = Math.max(at, c.currentTime);
      source.start(at);
      at += buffer.duration;
      playing += 1;
      source.onended = () => {
        playing -= 1;
        if (playing === 0) onIdle?.();
      };
      m.start();
    },
    finish(): Promise<void> {
      return new Promise((resolve) => {
        const done = () => {
          window.clearTimeout(guard);
          onIdle = null;
          m.stop();
          resolve();
        };
        const guard = window.setTimeout(done, Math.max(0, at - c.currentTime) * 1000 + STALL_GRACE_MS);
        if (playing === 0) done();
        else onIdle = done;
      });
    },
  };
}
