import { describe, expect, it } from "vitest";
import { SpeechTally, isSilentClip } from "../speechTally";
import type { LevelSample } from "../levelMeter";

const sample = (active: boolean): LevelSample => ({ levelDb: active ? -30 : -70, active, valid: true, calibrated: false });

describe("SpeechTally", () => {
  it("counts voiced time only while the meter runs", () => {
    const t = new SpeechTally(100);
    for (let i = 0; i < 10; i++) t.add(sample(i < 7), true);
    t.add(sample(true), false);
    expect(t.summary()).toEqual({ measured: true, voicedMs: 700 });
  });

  it("is unmeasured when the meter never ran, so the clip is not called silent", () => {
    const t = new SpeechTally(100);
    for (let i = 0; i < 10; i++) t.add(sample(false), false);
    expect(t.summary().measured).toBe(false);
    expect(isSilentClip(t.summary(), 600)).toBe(false);
  });

  it("treats a running but quiet clip as silent, and a spoken one as not", () => {
    const quiet = new SpeechTally(100);
    for (let i = 0; i < 30; i++) quiet.add(sample(i < 2), true);
    expect(isSilentClip(quiet.summary(), 600)).toBe(true);

    const spoken = new SpeechTally(100);
    for (let i = 0; i < 30; i++) spoken.add(sample(i % 3 !== 0), true);
    expect(isSilentClip(spoken.summary(), 600)).toBe(false);
  });
});
