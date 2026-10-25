import { describe, it, expect } from "vitest";
import { SignalAligner } from "../aligner";
import type { VisionObservation } from "../pipeline";

const obs = (signal: string, value: number, timestamp: number, valid = true): VisionObservation => ({
  signal,
  value,
  timestamp,
  confidence: 1,
  valid,
});

describe("SignalAligner", () => {
  it("returns the latest value per signal", () => {
    const a = new SignalAligner(500);
    a.push([obs("head_yaw_proxy", 0.1, 1000), obs("head_yaw_proxy", 0.2, 1100)]);
    a.push([obs("voice_active", 1, 1050)]);
    const f = a.snapshot(1200);
    expect(f.signals["head_yaw_proxy"]?.value).toBe(0.2);
    expect(f.signals["voice_active"]?.value).toBe(1);
  });

  it("marks stale readings invalid", () => {
    const a = new SignalAligner(500);
    a.push([obs("voice_active", 1, 1000)]);
    expect(a.snapshot(1400).signals["voice_active"]?.valid).toBe(true);
    expect(a.snapshot(1600).signals["voice_active"]?.valid).toBe(false);
  });

  it("keeps invalid observations invalid", () => {
    const a = new SignalAligner(500);
    a.push([obs("head_yaw_proxy", 0, 1000, false)]);
    expect(a.snapshot(1100).signals["head_yaw_proxy"]?.valid).toBe(false);
  });

  it("ignores out-of-order older observations", () => {
    const a = new SignalAligner(500);
    a.push([obs("x", 2, 2000)]);
    a.push([obs("x", 1, 1000)]);
    expect(a.snapshot(2100).signals["x"]?.value).toBe(2);
  });

  it("reset clears everything", () => {
    const a = new SignalAligner(500);
    a.push([obs("x", 1, 1000)]);
    a.reset();
    expect(Object.keys(a.snapshot(1100).signals)).toHaveLength(0);
  });
});