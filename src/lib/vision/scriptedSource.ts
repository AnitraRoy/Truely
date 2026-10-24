/**
 * Scripted VisionSource for tests and the simulated demo. No camera involved.
 * Frames come from a deterministic scenario function, so anything produced
 * with this source is SIMULATED and must be labelled as such in the UI.
 */
import type { VisionFrame } from "@/types";
import type { VisionSource } from "./types";

export interface ScriptedSample {
  /** Head yaw in degrees. */
  yaw: number;
  pitch?: number;
  /** Set false to simulate a lost face. Defaults to true. */
  faceDetected?: boolean;
  /** 0..1. Defaults to 0.95. */
  confidence?: number;
}

/** Small deterministic "natural jitter" in roughly [-1, 1]. */
export const wobble = (tMs: number): number =>
  0.7 * Math.sin(tMs / 370) + 0.3 * Math.sin(tMs / 130);

export interface ScriptedVisionOptions {
  /** Called with ms elapsed since the source was created. */
  scenario: (tMs: number) => ScriptedSample;
  /** Absolute clock value (ms) of the first frame. Default 0. */
  startAt?: number;
  /** Frames per second of virtual time. Default 10. */
  hz?: number;
}

export interface ScriptedVisionSource extends VisionSource {
  /** Current virtual clock (absolute ms). */
  now(): number;
  /** Advance virtual time by `ms`, emitting frames if the source is active. */
  pump(ms: number): void;
}

export function createScriptedVisionSource(options: ScriptedVisionOptions): ScriptedVisionSource {
  const stepMs = 1000 / (options.hz ?? 10);
  const startAt = options.startAt ?? 0;
  let now = startAt;
  let active = false;
  const frameSubs = new Set<(f: VisionFrame) => void>();

  return {
    async start() {
      active = true;
    },
    stop() {
      active = false;
    },
    isActive: () => active,
    onFrame(cb) {
      frameSubs.add(cb);
      return () => {
        frameSubs.delete(cb);
      };
    },
    now: () => now,
    pump(ms) {
      const end = now + ms;
      while (now < end) {
        now += stepMs;
        if (!active) continue;
        const s = options.scenario(now - startAt);
        const ok = s.faceDetected !== false;
        const frame: VisionFrame = {
          timestamp: now,
          faceDetected: ok,
          trackingConfidence: ok ? (s.confidence ?? 0.95) : 0,
          headPose: ok ? { yaw: s.yaw, pitch: s.pitch ?? 0, roll: 0 } : undefined,
        };
        frameSubs.forEach((cb) => cb(frame));
      }
    },
  };
}