import { describe, expect, it } from "vitest";
import { HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import { isDirectionMet, movementToward, neutralFrom, type PoseReading } from "../headRangeGate";

const { yawDelta, pitchDelta, yawLeftSign, pitchUpSign } = HEAD_RANGE_CALIBRATION.detect;
const center = { yaw: 0.01, pitch: 0.55 };
const reading = (yaw: number, pitch: number, valid = true): PoseReading => ({ yaw, pitch, valid });

describe("head-range gate", () => {
  it("finds the center pose from the median of valid readings, ignoring lost-face frames", () => {
    const n = neutralFrom([reading(0.0, 0.5), reading(0.02, 0.6), reading(0.01, 0.55), reading(0.9, 0.9, false)]);
    expect(n?.yaw).toBeCloseTo(0.01);
    expect(n?.pitch).toBeCloseTo(0.55);
    expect(neutralFrom([reading(0, 0, false)])).toBeNull();
    expect(neutralFrom([])).toBeNull();
  });

  it("center needs only a visible face", () => {
    expect(isDirectionMet("center", reading(0.4, 0.9), null)).toBe(true);
    expect(isDirectionMet("center", reading(0, 0.5, false), null)).toBe(false);
    expect(isDirectionMet("center", null, null)).toBe(false);
  });

  it("left and right need a real yaw change from the person's own center, in the right direction", () => {
    const left = reading(center.yaw + yawLeftSign * (yawDelta + 0.01), center.pitch);
    const right = reading(center.yaw - yawLeftSign * (yawDelta + 0.01), center.pitch);
    expect(isDirectionMet("left", left, center)).toBe(true);
    expect(isDirectionMet("right", left, center)).toBe(false);
    expect(isDirectionMet("right", right, center)).toBe(true);
    expect(isDirectionMet("left", right, center)).toBe(false);
    // A small drift is not enough.
    expect(isDirectionMet("left", reading(center.yaw + yawLeftSign * (yawDelta / 3), center.pitch), center)).toBe(false);
  });

  it("up and down need a real pitch change from center, in the right direction", () => {
    const up = reading(center.yaw, center.pitch + pitchUpSign * (pitchDelta + 0.01));
    const down = reading(center.yaw, center.pitch - pitchUpSign * (pitchDelta + 0.01));
    expect(isDirectionMet("up", up, center)).toBe(true);
    expect(isDirectionMet("down", up, center)).toBe(false);
    expect(isDirectionMet("down", down, center)).toBe(true);
    expect(isDirectionMet("up", down, center)).toBe(false);
  });

  it("is judged against each person's own center, so the same raw reading can differ between people", () => {
    const raw = reading(0.09, 0.55);
    expect(isDirectionMet("left", raw, { yaw: 0, pitch: 0.55 })).toBe(yawLeftSign === 1);
    // Someone whose natural center already sits at 0.09 has not moved at all.
    expect(isDirectionMet("left", raw, { yaw: 0.09, pitch: 0.55 })).toBe(false);
    expect(movementToward("left", raw, { yaw: 0.09, pitch: 0.55 })).toBeCloseTo(0);
  });

  it("never counts a movement without a usable face or a center pose", () => {
    expect(isDirectionMet("left", reading(1, 0.55, false), center)).toBe(false);
    expect(isDirectionMet("left", reading(1, 0.55), null)).toBe(false);
    expect(isDirectionMet("left", null, center)).toBe(false);
  });
});
