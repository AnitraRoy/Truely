
import type { AudioCalibration } from "./calibration";

export interface LevelSample {
  levelDb: number;     // dBFS, negative; louder = closer to 0
  active: boolean;
  valid: boolean;      // false if the mic is silent/muted or the audio context isn't running
  calibrated: boolean; // true if a personal calibration is applied
}

const FFT_SIZE = 1024;
const SILENCE_DB = -95;

// Tunable heuristics (the repo prefers thresholds in src/config)
export const AUDIO_CONSTANTS = {
  activeMarginDb: 12,       // UNCALIBRATED fallback: speaking = this far above the running floor
  floorRiseDbPerTick: 0.01, // UNCALIBRATED fallback: how fast the floor adapts upward
  hysteresisDb: 3,          // once active, the level must drop this far below the threshold to stop
  hangoverTicks: 4,         // keep "active" this many ticks (~400 ms) so gaps between words aren't pauses
} as const;

export class LevelMeter {
  private readonly ctx: AudioContext;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly analyser: AnalyserNode;
  private readonly buf = new Float32Array(FFT_SIZE);
  private floor: number | null = null;
  private calibration: AudioCalibration | null = null;
  private wasActive = false;
  private hangover = 0;

  constructor(stream: MediaStream) {
    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    // Deliberately NOT connected to ctx.destination: no playback, no feedback.
    this.source.connect(this.analyser);
  }

  setCalibration(c: AudioCalibration | null): void {
    this.calibration = c;
    this.wasActive = false;
    this.hangover = 0;
  }

  resume(): Promise<void> {
    return this.ctx.resume();
  }

  /** True while the audio context runs, i.e. read() reflects the microphone. */
  get running(): boolean {
    return this.ctx.state === "running";
  }

  read(): LevelSample {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (const s of this.buf) sum += s * s;
    const rms = Math.sqrt(sum / this.buf.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const calibrated = this.calibration !== null;

    if (this.ctx.state !== "running" || db <= SILENCE_DB) {
      this.wasActive = false;
      this.hangover = 0;
      return { levelDb: SILENCE_DB, active: false, valid: false, calibrated };
    }

    const c = AUDIO_CONSTANTS;
    let onThreshold: number;
    if (this.calibration) {
      onThreshold = this.calibration.speechThresholdDb;
    } else {
      this.floor = this.floor === null ? db : Math.min(db, this.floor + c.floorRiseDbPerTick);
      onThreshold = this.floor + c.activeMarginDb;
    }
    const threshold = this.wasActive ? onThreshold - c.hysteresisDb : onThreshold;

    if (db > threshold) {
      this.wasActive = true;
      this.hangover = c.hangoverTicks;
    } else if (this.hangover > 0) {
      this.hangover -= 1; // short dip: stay active
    } else {
      this.wasActive = false;
    }

    return { levelDb: db, active: this.wasActive, valid: true, calibrated };
  }

  close(): void {
    this.source.disconnect();
    void this.ctx.close();
  }
}
