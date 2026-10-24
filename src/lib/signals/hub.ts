import { AudioSignalSource, type AudioCalibration, type AudioStatus } from "@/lib/audio";
import type { TrackingIssue } from "@/lib/vision";
import { SignalAligner, type AlignedFrame } from "./aligner";
import { SignalPipeline, type PipelineStatus, type VisionObservation } from "./pipeline";

export type SignalSourceName = "camera" | "microphone" | "model";

export interface HubOptions {
  onFrame: (frame: AlignedFrame) => void;                  // aligned frames, every frameIntervalMs
  onObservations?: (obs: VisionObservation[]) => void;     // raw stream (for recording / reports)
  onError?: (source: SignalSourceName, code: string, message: string) => void;
  onTrackingIssue?: (issue: TrackingIssue | null) => void; // drives the "Tracking is limited" message
  enableAudio?: boolean;                                   // default FALSE (opt-in)
  audioCalibration?: AudioCalibration | null;              // selected profile's audio calibration
  frameIntervalMs?: number;                                // default 200
  maxAgeMs?: number;                                       // staleness limit, default 500
}

export class SignalHub {
  private readonly aligner: SignalAligner;
  private readonly pipeline: SignalPipeline;
  private readonly audio: AudioSignalSource | null;
  private readonly opts: HubOptions;
  private readonly frameIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  constructor(opts: HubOptions) {
    this.opts = opts;
    this.frameIntervalMs = opts.frameIntervalMs ?? 200;
    this.aligner = new SignalAligner(opts.maxAgeMs);

    const forward = (obs: VisionObservation[]) => {
      this.aligner.push(obs);
      opts.onObservations?.(obs);
    };

    this.pipeline = new SignalPipeline({
      onObservations: forward,
      onTrackingIssue: opts.onTrackingIssue,
      onError: (code, msg) =>
        opts.onError?.(code === "model_load_failed" ? "model" : "camera", code, msg),
    });

    this.audio = opts.enableAudio
      ? new AudioSignalSource({
          calibration: opts.audioCalibration,
          onObservations: forward,
          onError: (code, msg) => opts.onError?.("microphone", code, msg),
        })
      : null;
  }

  getStatus(): { camera: PipelineStatus; microphone: AudioStatus | null } {
    return { camera: this.pipeline.getStatus(), microphone: this.audio?.getStatus() ?? null };
  }

  /** Switch profile or recalibrate on the fly. No-op if audio is disabled. */
  setAudioCalibration(c: AudioCalibration | null): void {
    this.audio?.setCalibration(c);
  }

  /**
   * Starts camera, then mic (if enabled). Call from a user click. A mic failure does NOT stop the camera.
   * Never throws. The caller decides what to do if one source is false.
   */
  async start(video: HTMLVideoElement): Promise<{ camera: boolean; microphone: boolean }> {
    const camera = await this.pipeline.start(video);
    const microphone = this.audio ? await this.audio.start() : false;
    this.active = camera || microphone;
    if (this.active) this.startTimer();
    return { camera, microphone };
  }

  pause() {
    if (!this.active) return;
    this.clearTimer();
    this.pipeline.pause();
    this.audio?.pause();
  }

  resume() {
    if (!this.active) return;
    this.pipeline.resume();
    this.audio?.resume();
    this.startTimer();
  }

  /** Releases the camera AND the microphone. */
  stop() {
    this.active = false;
    this.clearTimer();
    this.pipeline.stop();
    this.audio?.stop();
    this.aligner.reset();
  }

  dispose() {
    this.active = false;
    this.clearTimer();
    this.pipeline.dispose();
    this.audio?.dispose();
    this.aligner.reset();
  }

  private startTimer() {
    this.clearTimer();
    this.timer = setInterval(() => this.opts.onFrame(this.aligner.snapshot()), this.frameIntervalMs);
  }

  private clearTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}