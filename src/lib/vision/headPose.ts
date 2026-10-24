
export type Landmark = { x: number; y: number; z: number };

export interface YawSample {
  value: number;
  quality: number;
  valid: boolean;
}

const NOSE_TIP = 1;
const LEFT_EDGE = 234;
const RIGHT_EDGE = 454;
const TOP = 10;
const CHIN = 152;

export const HEAD_POSE_CONSTANTS = {
  minValidQuality: 0.4,
  faceWidthFullQuality: 0.25,
  faceWidthZeroQuality: 0.1,
} as const;

const INVALID: YawSample = { value: 0, quality: 0, valid: false };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function estimateYawProxy(
  landmarks: Landmark[] | null
): YawSample {
  if (!landmarks) return INVALID;

  const nose = landmarks[NOSE_TIP];
  const left = landmarks[LEFT_EDGE];
  const right = landmarks[RIGHT_EDGE];
  const top = landmarks[TOP];
  const chin = landmarks[CHIN];

  if (!nose || !left || !right || !top || !chin) return INVALID;

  const faceWidth = Math.abs(right.x - left.x);
  if (faceWidth < 1e-6) return INVALID;

  const c = HEAD_POSE_CONSTANTS;
  const sizeScore = clamp(
    (faceWidth - c.faceWidthZeroQuality) /
      (c.faceWidthFullQuality - c.faceWidthZeroQuality),
    0,
    1
  );

  const inFrame = [nose, left, right, top, chin].every(
    (p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99
  );

  const quality = inFrame ? sizeScore : sizeScore * 0.5;
  const value =
    (nose.x - (left.x + right.x) / 2) / faceWidth;

  return { value, quality, valid: quality >= c.minValidQuality };
}
