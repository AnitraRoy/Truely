
import type { VisionObservation } from "./pipeline";

export interface AlignedSignal {
  value: number;
  confidence: number;
  valid: boolean;
  ageMs: number;
}

export interface AlignedFrame {
  timestamp: number;
  signals: Record<string, AlignedSignal>;
}

/** Keeps the latest observation per signal and snapshots them at a common timestamp. */
export class SignalAligner {
  private latest = new Map<string, VisionObservation>();
  private readonly maxAgeMs: number;

  constructor(maxAgeMs = 500) {
    this.maxAgeMs = maxAgeMs;
  }

  push(obs: VisionObservation[]): void {
    for (const o of obs) {
      const prev = this.latest.get(o.signal);
      if (!prev || o.timestamp >= prev.timestamp) {
        this.latest.set(o.signal, o);
      }
    }
  }

  snapshot(now: number = Date.now()): AlignedFrame {
    const signals: Record<string, AlignedSignal> = {};

    for (const [name, o] of this.latest) {
      const ageMs = Math.max(0, now - o.timestamp);
      signals[name] = {
        value: o.value,
        confidence: o.confidence,
        valid: o.valid && ageMs <= this.maxAgeMs,
        ageMs,
      };
    }

    return { timestamp: now, signals };
  }

  reset(): void {
    this.latest.clear();
  }
}

