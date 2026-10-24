import { describe, it, expect } from "vitest";
import { estimateYawProxy, estimateHeadPose, headMotionSpeed, type Landmark } from "../headPose";

function face(noseX: number, width = 0.3): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[234] = { x: 0.5 - width / 2, y: 0.5, z: 0 };
  lm[454] = { x: 0.5 + width / 2, y: 0.5, z: 0 };
  lm[1] = { x: noseX, y: 0.5, z: 0 };
  lm[10] = { x: 0.5, y: 0.35, z: 0 };
  lm[152] = { x: 0.5, y: 0.65, z: 0 };
  return lm;
}

describe("estimateYawProxy", () => {
  it("is ~0 and valid for a centered face", () => {
    const s = estimateYawProxy(face(0.5));
    expect(s.valid).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(1e-6);
  });
  it("is positive when the nose shifts right, negative when left", () => {
    expect(estimateYawProxy(face(0.6)).value).toBeGreaterThan(0);
    expect(estimateYawProxy(face(0.4)).value).toBeLessThan(0);
  });
  it("is invalid with no face", () => {
    const s = estimateYawProxy(null);
    expect(s.valid).toBe(false);
    expect(s.value).toBe(0);
  });
  it("is invalid for a tiny face", () => {
    expect(estimateYawProxy(face(0.5, 0.05)).valid).toBe(false);
  });
});

describe("estimateHeadPose", () => {
  it("pitch proxy increases as the nose moves toward the chin", () => {
    const level = face(0.5);
    const lower = face(0.5);
    lower[1] = { x: 0.5, y: 0.55, z: 0 };
    expect(estimateHeadPose(lower).pitch).toBeGreaterThan(estimateHeadPose(level).pitch);
  });
  it("reports why tracking is invalid", () => {
    expect(estimateHeadPose(null).issue).toBe("no_face");
    expect(estimateHeadPose(face(0.5, 0.05)).issue).toBe("face_too_small");
  });
});

describe("headMotionSpeed", () => {
  const a = { noseX: 0.5, noseY: 0.5, faceWidth: 0.3, timestamp: 0 };
  it("is 0 when the nose does not move", () => {
    expect(headMotionSpeed(a, { ...a, timestamp: 100 }, 640, 480)).toBe(0);
  });
  it("is in face-widths per second", () => {
    // 0.03 * 640 = 19.2 px; face = 192 px; 0.1 face-widths in 0.1 s = 1.0 /s
    const v = headMotionSpeed(a, { ...a, noseX: 0.53, timestamp: 100 }, 640, 480);
    expect(v).toBeCloseTo(1.0, 5);
  });
  it("returns null across a tracking gap", () => {
    expect(headMotionSpeed(a, { ...a, timestamp: 600 }, 640, 480)).toBeNull();
  });
});