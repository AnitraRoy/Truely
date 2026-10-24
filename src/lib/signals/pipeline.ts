import { openCamera, releaseStream, type CameraErrorCode } from "@/lib/camera";
import {
  createLandmarker,
  detectLandmarks,
  estimateHeadPose,
  headMotionSpeed,
  LightingProbe,
  type HeadPoseSample,
  type Landmarker,
  type LightingIssue,
  type PoseAnchor,
  type TrackingIssue,
} from "@/lib/vision";

export const YAW_SIGNAL = "head_yaw_proxy";
export const PITCH_SIGNAL = "head_pitch_proxy"; // experimental until validated
export const MOTION_SIGNAL = "head_motion";     // face-widths per second

/** Same shape as the PRD's SignalObservation. Swap for the shared type in Step 15. */
export interface VisionObservation {
  timestamp: number; // Date.now(), epoch ms
  signal: string;
  value: number;
  confidence: number;
  valid: boolean;
}

export type PipelineStatus = "idle" | "loading" | "ready" | "running" | "paused" | "error";
export type PipelineErrorCode = CameraErrorCode | "model_load_failed";

export interface PipelineOptions {
  onObservations: (obs: VisionObservation[]) => void;
  onStatus?: (status: PipelineStatus) => void;
  onError?: (code: PipelineErrorCode, message: string) => void;
  /** Called only when the tracking problem CHANGES. null = tracking is fine. Use it for the "Tracking is limited" message. */
  onTrackingIssue?: (issue: TrackingIssue | null) => void;
  targetFps?: number;      // default 15
  smoothingAlpha?: number; // 1 = no smoothing (default). Lower = smoother. Agree with Person 3 first.
}

const LIGHTING_INTERVAL_MS = 500;

export class SignalPipeline {
  private readonly opts: PipelineOptions;
  private readonly targetFps: number;
  private readonly alpha: number;
  private landmarker: Landmarker | null = null;
  private initPromise: Promise<boolean> | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private lighting: LightingProbe | null = null;
  private rafId: number | null = null;
  private lastProcessed = 0;
  private lastVideoTime = -1;
  private lastLightingCheck = 0;
  private lastLighting: LightingIssue | null = null;
  private lastIssue: TrackingIssue | null = null;
  private prevAnchor: PoseAnchor | null = null;
  private readonly ema = new Map<string, number>();
  private status: PipelineStatus = "idle";
  private starting = false;
  private disposed = false;

  constructor(opts: PipelineOptions) {
    this.opts = opts;
    this.targetFps = opts.targetFps ?? 15;
    this.alpha = Math.min(1, Math.max(0.05, opts.smoothingAlpha ?? 1));
  }

  getStatus(): PipelineStatus {
    return this.status;
  }

  private setStatus(s: PipelineStatus) {
    this.status = s;
    this.opts.onStatus?.(s);
  }

  private fail(code: PipelineErrorCode, message: string) {
    this.setStatus("error");
    this.opts.onError?.(code, message);
  }

  /** Loads the model. Returns true on success. Never throws. Safe to call repeatedly. */
  init(): Promise<boolean> {
    if (this.landmarker) return Promise.resolve(true);
    if (!this.initPromise) {
      this.initPromise = this.doInit().finally(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    this.setStatus("loading");
    try {
      const lm = await createLandmarker();
      if (this.disposed) {
        lm.close();
        return false;
      }
      this.landmarker = lm;
      this.setStatus("ready");
      return true;
    } catch (e) {
      this.fail("model_load_failed", e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  /**
   * Opens the camera, attaches it to the <video>, starts emitting observations.
   * Idempotent: calling while running restarts cleanly (never two streams).
   * Returns true on success. Never throws.
   */
  async start(video: HTMLVideoElement): Promise<boolean> {
    if (this.disposed || this.starting) return false;
    this.starting = true;
    try {
      if (this.status === "running" || this.status === "paused") this.stop();
      if (!(await this.init())) return false;

      const cam = await openCamera();
      if (!cam.ok) {
        this.fail(cam.code, cam.message);
        return false;
      }
      const stream = cam.stream;

      // Disposed while the permission prompt was open: release immediately.
      if (this.disposed) {
        releaseStream(stream);
        return false;
      }

      this.stream = stream;
      this.video = video;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        this.stop();
        this.fail("unknown", "Could not start video playback.");
        return false;
      }

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (this.stream !== stream) return; // stale listener
        this.stop();
        this.fail("camera_not_found", "Camera disconnected.");
      });

      this.lighting = new LightingProbe();
      this.lastLighting = null;
      this.lastLightingCheck = 0;
      this.prevAnchor = null;
      this.ema.clear();
      this.lastVideoTime = -1;
      this.setStatus("running");
      this.rafId = requestAnimationFrame(this.loop);
      return true;
    } finally {
      this.starting = false;
    }
  }

  pause() {
    if (this.status !== "running") return;
    this.cancelLoop();
    this.ema.clear();
    this.prevAnchor = null;
    this.setStatus("paused");
  }

  resume() {
    if (this.status !== "paused") return;
    this.setStatus("running");
    this.rafId = requestAnimationFrame(this.loop);
  }

  /** Stops processing AND releases the camera. The model stays loaded. */
  stop() {
    this.cancelLoop();
    releaseStream(this.stream);
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.lighting = null;
    this.prevAnchor = null;
    this.lastIssue = null;
    this.ema.clear();
    if (this.status !== "error") this.setStatus(this.landmarker ? "ready" : "idle");
  }

  /** Full cleanup. Call on unmount. The instance is not reusable afterwards. */
  dispose() {
    this.disposed = true;
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
    this.setStatus("idle");
  }

  private cancelLoop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private smooth(signal: string, valid: boolean, value: number): number {
    if (!valid) {
      this.ema.delete(signal); // don't carry stale values across a tracking gap
      return 0;
    }
    const prev = this.ema.get(signal);
    const next = prev === undefined ? value : this.alpha * value + (1 - this.alpha) * prev;
    this.ema.set(signal, next);
    return next;
  }

  private makeObs(
    timestamp: number,
    signal: string,
    value: number,
    confidence: number,
    valid: boolean
  ): VisionObservation {
    return { timestamp, signal, value: this.smooth(signal, valid, value), confidence, valid };
  }

  private checkLighting(video: HTMLVideoElement, pose: HeadPoseSample, now: number): LightingIssue | null {
    if (pose.box && this.lighting && now - this.lastLightingCheck >= LIGHTING_INTERVAL_MS) {
      this.lastLightingCheck = now;
      const r = this.lighting.measure(video, pose.box);
      this.lastLighting = r ? r.issue : null; // can't measure -> don't block
    }
    return this.lastLighting;
  }

  private reportIssue(issue: TrackingIssue | null) {
    if (issue === this.lastIssue) return;
    this.lastIssue = issue;
    this.opts.onTrackingIssue?.(issue);
  }

  private loop = () => {
    if (this.status !== "running" || !this.video || !this.landmarker) return;
    const now = performance.now();
    const v = this.video;

    if (
      now - this.lastProcessed >= 1000 / this.targetFps &&
      v.readyState >= 2 &&
      v.currentTime !== this.lastVideoTime
    ) {
      this.lastProcessed = now;
      this.lastVideoTime = v.currentTime;
      try {
        const pose = estimateHeadPose(detectLandmarks(this.landmarker, v, now));
        const lightingIssue = this.checkLighting(v, pose, now);
        this.reportIssue(pose.issue ?? lightingIssue);
        const valid = pose.valid && lightingIssue === null;

        let motion: number | null = null;
        if (valid) {
          const anchor: PoseAnchor = {
            noseX: pose.noseX,
            noseY: pose.noseY,
            faceWidth: pose.faceWidth,
            timestamp: now,
          };
          if (this.prevAnchor) {
            motion = headMotionSpeed(this.prevAnchor, anchor, v.videoWidth, v.videoHeight);
          }
          this.prevAnchor = anchor;
        } else {
          this.prevAnchor = null;
        }

        const ts = Date.now();
        this.opts.onObservations([
          this.makeObs(ts, YAW_SIGNAL, pose.yaw, pose.quality, valid),
          this.makeObs(ts, PITCH_SIGNAL, pose.pitch, pose.quality, valid),
          // The first valid frame after a gap has no previous anchor, so motion is invalid for that one frame.
          this.makeObs(ts, MOTION_SIGNAL, motion ?? 0, pose.quality, valid && motion !== null),
        ]);
      } catch (e) {
        console.error("Frame processing failed", e);
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}