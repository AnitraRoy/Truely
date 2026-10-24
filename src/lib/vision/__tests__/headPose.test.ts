
import { describe, expect, it } from "vitest";
import { estimateYawProxy } from "../headPose";
import type { Landmark } from "../headPose";

function makeLandmarks(
  noseX = 0.5,
  faceWidth = 0.3
): Landmark[] {
  const landmarks: Landmark[] = Array.from(
    { length: 468 },
    () => ({ x: 0.5, y: 0.5, z: 0 })
  );

  landmarks[1] = { x: noseX, y: 0.5, z: 0 };
  landmarks[234] = { x: 0.5 - faceWidth / 2, y: 0.5, z: 0 };
  landmarks[454] = { x: 0.5 + faceWidth / 2, y: 0.5, z: 0 };
  landmarks[10] = { x: 0.5, y: 0.2, z: 0 };
  landmarks[152] = { x: 0.5, y: 0.8, z: 0 };

  return landmarks;
}

describe("estimateYawProxy", () => {
  it("returns invalid for missing landmarks", () => {
    expect(estimateYawProxy(null).valid).toBe(false);
  });

  it("returns a valid sample for a large, in-frame face", () => {
    const result = estimateYawProxy(makeLandmarks());

    expect(result.valid).toBe(true);
    expect(result.quality).toBe(1);
    expect(result.value).toBeCloseTo(0);
  });

  it("returns a positive proxy when the nose is right of the face midpoint", () => {
    const result = estimateYawProxy(makeLandmarks(0.53));

    expect(result.value).toBeGreaterThan(0);
  });

  it("returns a negative proxy when the nose is left of the face midpoint", () => {
    const result = estimateYawProxy(makeLandmarks(0.47));

    expect(result.value).toBeLessThan(0);
  });

  it("marks a very small face as invalid", () => {
    const result = estimateYawProxy(makeLandmarks(0.5, 0.05));

    expect(result.valid).toBe(false);
  });
});
