import { describe, it, expect } from "vitest";
import { AudioCalibrator } from "../calibration";

const quiet = () => Array.from({ length: 50 }, (_, i) => -60 + (i % 3)); // -60..-58
const speechWithPauses = () => [
  ...Array.from({ length: 50 }, (_, i) => -28 + (i % 5)), // speech -28..-24
  ...Array.from({ length: 50 }, () => -62),               // pauses
];

function run(q: number[], s: number[]) {
  const c = new AudioCalibrator();
  q.forEach((x) => c.addQuiet(x));
  s.forEach((x) => c.addSpeech(x));
  return c.finish(1000);
}

describe("AudioCalibrator", () => {
  it("produces a calibration and excludes pauses from the speech stats", () => {
    const r = run(quiet(), speechWithPauses());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.calibration.noiseFloorDb).toBe(-58);
      expect(r.calibration.speechThresholdDb).toBeCloseTo(-45.2, 5);
      expect(r.calibration.speechMeanDb).toBeCloseTo(-26, 5);
      expect(r.calibration.speechSamples).toBe(50);
    }
  });

  it("fails with too little quiet audio", () => {
    const r = run(quiet().slice(0, 10), speechWithPauses());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_enough_quiet_samples");
  });

  it("fails when nobody speaks", () => {
    const r = run(quiet(), Array.from({ length: 100 }, () => -60));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_enough_speech_samples");
  });

  it("fails when speech is too close to the noise", () => {
    const r = run(quiet(), Array.from({ length: 60 }, () => -50));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("speech_not_distinguishable_from_noise");
  });

  it("same live level gives different decisions under different calibrations", () => {
    const quietRoom = run(quiet(), speechWithPauses());
    const loudSpeaker = run(quiet(), [...Array.from({ length: 60 }, (_, i) => -15 + (i % 5))]);
    expect(quietRoom.ok && loudSpeaker.ok).toBe(true);
    if (quietRoom.ok && loudSpeaker.ok) {
      const level = -42;
      expect(level > quietRoom.calibration.speechThresholdDb).toBe(true);
      expect(level > loudSpeaker.calibration.speechThresholdDb).toBe(false);
    }
  });
});