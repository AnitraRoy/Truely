import { describe, expect, it } from "vitest";
import { HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import { isDirectionMet, movementToward, neutralFrom, type PoseReading } from "../headRangeGate";

const { yawDelta, pitchDelta, yawLeftSign, pitchUpSign } = HEAD_RANGE_CALIBRATION.detect;
const centre = { yaw: 0.01, pitch: 0.55 };
const reading = (yaw: number, pitch: number, valid = true): PoseReading => ({ yaw, pitch, valid });

describe("head-range gate", () => {
  it("finds the centre pose from the median of valid readings, ignoring lost-face frames", () => {
    const n = neutralFrom([reading(0.0, 0.5), reading(0.02, 0.6), reading(0.01, 0.55), reading(0.9, 0.9, false)]);
    expect(n?.yaw).toBeCloseTo(0.01);
    expect(n?.pitch).toBeCloseTo(0.55);
    expect(neutralFrom([reading(0, 0, false)])).toBeNull();
    expect(neutralFrom([])).toBeNull();
  });

  it("centre needs only a visible face", () => {
    expect(isDirectionMet("center", reading(0.4, 0.9), null)).toBe(true);
    expect(isDirectionMet("center", reading(0, 0.5, false), null)).toBe(false);
    expect(isDirectionMet("center", null, null)).toBe(false);
  });

  it("left and right need a real yaw change from the person's own centre, in the right direction", () => {
    const left = reading(centre.yaw + yawLeftSign * (yawDelta + 0.01), centre.pitch);
    const right = reading(centre.yaw - yawLeftSign * (yawDelta + 0.01), centre.pitch);
    expect(isDirectionMet("left", left, centre)).toBe(true);
    expect(isDirectionMet("right", left, centre)).toBe(false);
    expect(isDirectionMet("right", right, centre)).toBe(true);
    expect(isDirectionMet("left", right, centre)).toBe(false);
    // A small drift is not enough.
    expect(isDirectionMet("left", reading(centre.yaw + yawLeftSign * (yawDelta / 3), centre.pitch), centre)).toBe(false);
  });

  it("up and down need a real pitch change from centre, in the right direction", () => {
    const up = reading(centre.yaw, centre.pitch + pitchUpSign * (pitchDelta + 0.01));
    const down = reading(centre.yaw, centre.pitch - pitchUpSign * (pitchDelta + 0.01));
    expect(isDirectionMet("up", up, centre)).toBe(true);
    expect(isDirectionMet("down", up, centre)).toBe(false);
    expect(isDirectionMet("down", down, centre)).toBe(true);
    expect(isDirectionMet("up", down, centre)).toBe(false);
  });

  it("is judged against each person's own centre, so the same raw reading can differ between people", () => {
    const raw = reading(0.09, 0.55);
    expect(isDirectionMet("left", raw, { yaw: 0, pitch: 0.55 })).toBe(yawLeftSign === 1);
    // Someone whose natural centre already sits at 0.09 has not moved at all.
    expect(isDirectionMet("left", raw, { yaw: 0.09, pitch: 0.55 })).toBe(false);
    expect(movementToward("left", raw, { yaw: 0.09, pitch: 0.55 })).toBeCloseTo(0);
  });

  it("never counts a movement without a usable face or a centre pose", () => {
    expect(isDirectionMet("left", reading(1, 0.55, false), centre)).toBe(false);
    expect(isDirectionMet("left", reading(1, 0.55), null)).toBe(false);
    expect(isDirectionMet("left", null, centre)).toBe(false);
  });
});
