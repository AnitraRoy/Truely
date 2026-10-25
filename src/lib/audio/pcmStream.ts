/**
 * Raw PCM capture for streaming speech-to-text (live transcript word-by-word
 * updates). Unlike LevelMeter (which samples a level on a timer), this hands
 * every audio buffer to the caller as it arrives, gaplessly, at the audio
 * context's native sample rate — what a realtime STT websocket needs.
 *
 * Uses ScriptProcessorNode: deprecated, but it needs no separate worklet
 * module file and every browser Cue targets still supports it. The processor
 * is routed through a silent GainNode rather than straight to the
 * destination, so capture keeps running without playing the mic back out
 * loud (some browsers only drive onaudioprocess while the graph is connected
 * to a destination).
 */
export interface PcmCapture {
  sampleRate: number;
  stop: () => void;
}

const BUFFER_SIZE = 2048;

export function startPcmCapture(stream: MediaStream, onFrame: (samples: Float32Array) => void): PcmCapture {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
  const silence = ctx.createGain();
  silence.gain.value = 0;

  processor.onaudioprocess = (e) => {
    // Copy: the input buffer is reused by the audio graph after this callback returns.
    onFrame(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(silence);
  silence.connect(ctx.destination);

  return {
    sampleRate: ctx.sampleRate,
    stop: () => {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      silence.disconnect();
      void ctx.close();
    },
  };
}

/** Float32 samples (-1..1) to little-endian 16-bit PCM bytes, what `pcm_s16le` expects. */
export function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
