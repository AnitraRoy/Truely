import type { VisionObservation } from "@/lib/signals";
import type { AudioCalibration } from "./calibration";
import { openMicrophone, releaseMic, type MicErrorCode } from "./micController";
import { LevelMeter } from "./levelMeter";

export const VOICE_LEVEL_SIGNAL = "voice_level_db";
export const VOICE_ACTIVE_SIGNAL = "voice_active";

export type AudioStatus = "idle" | "running" | "paused" | "error";

export interface AudioSourceOptions {
  onObservations: (obs: VisionObservation[]) => void;
  onStatus?: (s: AudioStatus) => void;
  onError?: (code: MicErrorCode, message: string) => void;
  intervalMs?: number;                   // default 100
  calibration?: AudioCalibration | null; // the selected profile's audio calibration
}

export class AudioSignalSource {
  private readonly opts: AudioSourceOptions;
  private readonly intervalMs: number;
  private calibration: AudioCalibration | null;
  private stream: MediaStream | null = null;
  private meter: LevelMeter | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: AudioStatus = "idle";
  private starting = false;
  private disposed = false;

  constructor(opts: AudioSourceOptions) {
    this.opts = opts;
    this.intervalMs = opts.intervalMs ?? 100;
    this.calibration = opts.calibration ?? null;
  }

  getStatus(): AudioStatus {
    return this.status;
  }

  isCalibrated(): boolean {
    return this.calibration !== null;
  }

  /** Switch profile or recalibrate on the fly. Pass null for the uncalibrated fallback. */
  setCalibration(c: AudioCalibration | null): void {
    this.calibration = c;
    this.meter?.setCalibration(c);
  }

  private setStatus(s: AudioStatus) {
    this.status = s;
    this.opts.onStatus?.(s);
  }

  private fail(code: MicErrorCode, message: string) {
    this.setStatus("error");
    this.opts.onError?.(code, message);
  }

  /** Call from a user gesture (button click). Never throws. */
  async start(): Promise<boolean> {
    if (this.disposed || this.starting) return false;
    this.starting = true;
    try {
      if (this.status === "running" || this.status === "paused") this.stop();

      const mic = await openMicrophone();
      if (!mic.ok) {
        this.fail(mic.code, mic.message);
        return false;
      }
      if (this.disposed) {
        releaseMic(mic.stream);
        return false;
      }

      this.stream = mic.stream;
      try {
        this.meter = new LevelMeter(mic.stream);
        this.meter.setCalibration(this.calibration);
        await this.meter.resume();
      } catch (e) {
        this.stop();
        this.fail("unknown", String(e));
        return false;
      }

      const stream = mic.stream;
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        if (this.stream !== stream) return;
        this.stop();
        this.fail("mic_not_found", "Microphone disconnected.");
      });

      this.setStatus("running");
      this.timer = setInterval(this.tick, this.intervalMs);
      return true;
    } finally {
      this.starting = false;
    }
  }

  pause() {
    if (this.status !== "running") return;
    this.clearTimer();
    this.setStatus("paused");
  }

  resume() {
    if (this.status !== "paused") return;
    this.setStatus("running");
    this.timer = setInterval(this.tick, this.intervalMs);
  }

  /** Stops metering AND releases the microphone. */
  stop() {
    this.clearTimer();
    this.meter?.close();
    this.meter = null;
    releaseMic(this.stream);
    this.stream = null;
    if (this.status !== "error") this.setStatus("idle");
  }

  dispose() {
    this.disposed = true;
    this.stop();
  }

  private clearTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private tick = () => {
    if (!this.meter) return;
    const s = this.meter.read();
    const timestamp = Date.now();
    // Heuristics: level confidence = "the mic delivers signal"; it does NOT detect speaker bleed.
    // voice_active is half-confidence until a personal calibration is applied.
    const levelConf = s.valid ? 1 : 0;
    const activeConf = s.valid ? (s.calibrated ? 1 : 0.5) : 0;
    this.opts.onObservations([
      { timestamp, signal: VOICE_LEVEL_SIGNAL, value: s.levelDb, confidence: levelConf, valid: s.valid },
      { timestamp, signal: VOICE_ACTIVE_SIGNAL, value: s.active ? 1 : 0, confidence: activeConf, valid: s.valid },
    ]);
  };
}