// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CalibrationError,
  createCalibrationCollector,
  createPersonalizationEngine,
} from "../index";
import type { SignalName, SignalObservation } from "@/types";

const SIGNAL: SignalName = "head_orientation";

/** Deterministic "natural wobble" around a center (no Math.random). */
export function wobble(center: number, amplitude: number, i: number): number {
  return center + amplitude * (0.7 * Math.sin(i * 0.9) + 0.3 * Math.sin(i * 2.3));
}

export function obs(
  timestamp: number,
  value: number,
  extra: Partial<SignalObservation> = {},
): SignalObservation {
  return { timestamp, signal: SIGNAL, value, confidence: 0.9, valid: true, ...extra };
}

export function calibrationSet(center: number, amplitude: number, n = 300): SignalObservation[] {
  return Array.from({ length: n }, (_, i) => obs(i * 100, wobble(center, amplitude, i)));
}

describe("calibration", () => {
  it("computes mean, variance and duration from valid observations", () => {
    const e = createPersonalizationEngine({ config: { minCalibrationSamples: 5 } });
    const b = e.calibrate(SIGNAL, [2, 4, 4, 4, 5, 5, 7, 9].map((v, i) => obs(i * 1000, v)));
    expect(b.mean).toBeCloseTo(5, 10);
    expect(b.variance).toBeCloseTo(32 / 7, 10); // sample variance
    expect(b.sampleCount).toBe(8);
    expect(b.calibrationDurationMs).toBe(7000);
    expect(e.getBaseline(SIGNAL)).toEqual(b);
  });

  it("ignores invalid, low-confidence and other-signal observations", () => {
    const e = createPersonalizationEngine({ config: { minCalibrationSamples: 3 } });
    const good = [obs(0, 10), obs(100, 10), obs(200, 10)];
    const junk = [
      obs(300, 999, { valid: false }),
      obs(400, 999, { confidence: 0.2 }),
      obs(500, 999, { value: NaN }),
      obs(600, 999, { signal: "gaze_direction" }),
    ];
    const b = e.calibrate(SIGNAL, [...good, ...junk]);
    expect(b.sampleCount).toBe(3);
    expect(b.mean).toBe(10);
  });

  it("refuses to build a baseline from too few reliable observations", () => {
    const e = createPersonalizationEngine();
    const few = calibrationSet(5, 2, 40);
    expect(() => e.calibrate(SIGNAL, few)).toThrow(CalibrationError);
    expect(e.getBaseline(SIGNAL)).toBeNull();
  });

  it("reports progress limited by both time and samples", () => {
    const c = createCalibrationCollector(SIGNAL, {
      minCalibrationSamples: 10,
      calibrationDurationMs: 1000,
    });
    expect(c.getProgress().fraction).toBe(0);
    for (let i = 0; i < 5; i++) c.add(obs(i * 100, 1));
    expect(c.getProgress().fraction).toBeCloseTo(0.4, 5); // 400ms/1000ms < 5/10 samples? -> min(0.5, 0.4)
    expect(c.getProgress().ready).toBe(false);
    for (let i = 5; i < 12; i++) c.add(obs(i * 100, 1));
    expect(c.getProgress().ready).toBe(true);
    c.add(obs(1300, 1, { signal: "gaze_direction" })); // other signals are ignored
    expect(c.getObservations()).toHaveLength(12);
  });
});

describe("assess", () => {
  it("returns a z-score against the personal baseline", () => {
    const e = createPersonalizationEngine({ config: { minStdDev: { head_orientation: 0.001 } } });
    e.loadBaseline({ signal: SIGNAL, sampleCount: 200, mean: 10, variance: 16, calibrationDurationMs: 40000, updatedAt: 0 });
    const a = e.assess(obs(0, 18)); // 8 away, std 4 → z = 2
    expect(a.deviationMagnitude).toBeCloseTo(2, 10);
    expect(a.isRelevantDeviation).toBe(true);
    expect(e.assess(obs(10_000, 12)).isRelevantDeviation).toBe(false);
  });

  it("floors the std-dev so a very steady calibration doesn't over-trigger", () => {
    const e = createPersonalizationEngine(); // floor for head_orientation = 2
    e.loadBaseline({ signal: SIGNAL, sampleCount: 200, mean: 0, variance: 0, calibrationDurationMs: 40000, updatedAt: 0 });
    expect(e.assess(obs(0, 3)).deviationMagnitude).toBeCloseTo(1.5, 10);
  });

  it("never flags anything without a baseline or with untrustworthy data", () => {
    const e = createPersonalizationEngine();
    expect(e.assess(obs(0, 999)).isRelevantDeviation).toBe(false); // no baseline yet
    e.calibrate(SIGNAL, calibrationSet(0, 3));
    expect(e.assess(obs(0, 999, { valid: false })).isRelevantDeviation).toBe(false);
    const lowConf = e.assess(obs(100, 999, { confidence: 0.1 }));
    expect(lowConf.isRelevantDeviation).toBe(false);
    expect(lowConf.confidence).toBe(0.1);
  });

  it("smooths: a single-frame spike is damped below its raw z-score", () => {
    const e = createPersonalizationEngine({ config: { minStdDev: { head_orientation: 0.001 } } });
    e.loadBaseline({ signal: SIGNAL, sampleCount: 200, mean: 10, variance: 16, calibrationDurationMs: 40000, updatedAt: 0 });
    e.assess(obs(0, 10));
    e.assess(obs(100, 10));
    const spike = e.assess(obs(200, 20)); // raw z = 2.5
    expect(spike.deviationMagnitude).toBeLessThan(2.5);
    expect(spike.deviationMagnitude).toBeGreaterThan(0);
  });

  it("different baselines → different decisions for the SAME input (PRD §17.10)", () => {
    const userA = createPersonalizationEngine(); // naturally moves a lot
    const userB = createPersonalizationEngine(); // naturally very still
    userA.calibrate(SIGNAL, calibrationSet(10, 8));
    userB.calibrate(SIGNAL, calibrationSet(1, 1));

    const sameInput = obs(0, 16);
    const a = userA.assess(sameInput);
    const b = userB.assess(sameInput);

    expect(a.isRelevantDeviation).toBe(false);
    expect(b.isRelevantDeviation).toBe(true);
    expect(b.deviationMagnitude).toBeGreaterThan(a.deviationMagnitude);
  });
});

describe("baseline updates", () => {
  const loaded = () => {
    const e = createPersonalizationEngine();
    e.loadBaseline({ signal: SIGNAL, sampleCount: 200, mean: 10, variance: 16, calibrationDurationMs: 40000, updatedAt: 0 });
    return e;
  };

  it("drifts slowly toward stable behavior", () => {
    const e = loaded();
    for (let i = 1; i <= 600; i++) e.updateDuringStablePeriod(obs(i * 100, 12)); // 60 s at z≈0.5
    const b = e.getBaseline(SIGNAL)!;
    expect(b.mean).toBeGreaterThan(10.2);
    expect(b.mean).toBeLessThan(11.5); // well short of 12 — it's slow
    expect(b.sampleCount).toBe(200 + 600);
  });

  it("does NOT adopt a sustained deviation as the new normal (PRD §7.2)", () => {
    const e = loaded();
    for (let i = 1; i <= 1200; i++) e.updateDuringStablePeriod(obs(i * 100, 30)); // z = 5
    expect(e.getBaseline(SIGNAL)!.mean).toBe(10);
  });

  it("stays frozen for a hold period after an unstable moment", () => {
    const e = loaded();
    e.updateDuringStablePeriod(obs(100, 30)); // deviation → freeze
    for (let i = 2; i <= 50; i++) e.updateDuringStablePeriod(obs(i * 100, 12)); // within 10 s hold
    expect(e.getBaseline(SIGNAL)!.mean).toBe(10);
    for (let i = 120; i <= 200; i++) e.updateDuringStablePeriod(obs(i * 100, 12)); // after hold
    expect(e.getBaseline(SIGNAL)!.mean).toBeGreaterThan(10);
  });

  it("supports reset / recalibration", () => {
    const e = loaded();
    e.clearBaseline(SIGNAL);
    expect(e.getBaseline(SIGNAL)).toBeNull();
    expect(e.getBaselines()).toEqual([]);
  });
});
