
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_CONSTANTS } from "../levelMeter";

describe("AUDIO_CONSTANTS", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a 12 dB voice activity margin", () => {
    expect(AUDIO_CONSTANTS.activeMarginDb).toBe(12);
  });

  it("has a non-negative noise floor rise rate", () => {
    expect(AUDIO_CONSTANTS.floorRiseDbPerTick).toBeGreaterThanOrEqual(0);
  });
});
