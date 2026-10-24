export type Landmark = { x: number; y: number; z: number };

export interface FaceBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} // normalized 0..1

export type PoseIssue = "no_face" | "face_too_small" | "out_of_frame";
export type TrackingIssue = PoseIssue | "too_dark" | "too_bright";

export interface HeadPoseSample {
  yaw: number;      // experimental proxy, unitless
  pitch: number;    // experimental proxy, unitless
  noseX: number;    // normalized image coords
  noseY: number;
  faceWidth: number; // fraction of frame width
  box: FaceBox | null;
  quality: number;  // 0..1 tracking-quality HEURISTIC (not a MediaPipe score)
  valid: boolean;
  issue: PoseIssue | null;
}

/** Anchor for frame-to-frame motion. */
export interface PoseAnchor {
  noseX: number;
  noseY: number;
  faceWidth: number;
  timestamp: number; // ms (performance.now)
}

// MediaPipe Face Mesh landmark indices
const NOSE_TIP = 1;
const LEFT_EDGE = 234;
const RIGHT_EDGE = 454;
const TOP = 10;
const CHIN = 152;

// Tunable. The repo prefers thresholds in src/config; tell Person 3 these exist.
export const HEAD_POSE_CONSTANTS = {
  minValidQuality: 0.4,
  faceWidthFullQuality: 0.25, // face width as a fraction of frame width
  faceWidthZeroQuality: 0.1,
  maxMotionGapSec: 0.5, // don't compute motion across a tracking gap
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function noFace(issue: PoseIssue = "no_face"): HeadPoseSample {
  return {
    yaw: 0,
    pitch: 0,
    noseX: 0,
    noseY: 0,
    faceWidth: 0,
    box: null,
    quality: 0,
    valid: false,
    issue,
  };
}

export function estimateHeadPose(landmarks: Landmark[] | null): HeadPoseSample {
  if (!landmarks) return noFace();
  const nose = landmarks[NOSE_TIP];
  const left = landmarks[LEFT_EDGE];
  const right = landmarks[RIGHT_EDGE];
  const top = landmarks[TOP];
  const chin = landmarks[CHIN];
  if (!nose || !left || !right || !top || !chin) return noFace();

  const faceWidth = Math.abs(right.x - left.x);
  const faceHeight = Math.abs(chin.y - top.y);
  if (faceWidth < 1e-6 || faceHeight < 1e-6) return noFace();

  const c = HEAD_POSE_CONSTANTS;
  const sizeScore = clamp(
    (faceWidth - c.faceWidthZeroQuality) / (c.faceWidthFullQuality - c.faceWidthZeroQuality),
    0,
    1
  );
  const inFrame = [nose, left, right, top, chin].every(
    (p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99
  );
  const quality = inFrame ? sizeScore : sizeScore * 0.5;
  const valid = quality >= c.minValidQuality;

  const box: FaceBox = {
    x0: clamp(Math.min(left.x, right.x), 0, 1),
    x1: clamp(Math.max(left.x, right.x), 0, 1),
    y0: clamp(Math.min(top.y, chin.y), 0, 1),
    y1: clamp(Math.max(top.y, chin.y), 0, 1),
  };

  return {
    // Nose offset from the midpoint of the face edges / face width.
    // Positive = nose toward the right of the RAW (unmirrored) camera image.
    yaw: (nose.x - (left.x + right.x) / 2) / faceWidth,
    // Nose position between forehead (0) and chin (1). Direction of "looking down" must be confirmed by the nod test.
    pitch: (nose.y - top.y) / faceHeight,
    noseX: nose.x,
    noseY: nose.y,
    faceWidth,
    box,
    quality,
    valid,
    issue: valid ? null : inFrame ? "face_too_small" : "out_of_frame",
  };
}

/**
 * Head-movement speed in FACE-WIDTHS PER SECOND (scale-invariant).
 * Includes both translation and rotation of the head. Returns null across tracking gaps.
 */
export function headMotionSpeed(
  prev: PoseAnchor,
  cur: PoseAnchor,
  videoW: number,
  videoH: number
): number | null {
  const dt = (cur.timestamp - prev.timestamp) / 1000;
  if (dt <= 0 || dt > HEAD_POSE_CONSTANTS.maxMotionGapSec) return null;
  const facePx = cur.faceWidth * videoW;
  if (facePx < 1) return null;
  const dx = (cur.noseX - prev.noseX) * videoW;
  const dy = (cur.noseY - prev.noseY) * videoH;
  return Math.hypot(dx, dy) / facePx / dt;
}

// Backwards-compatible wrapper (older callers and tests use it).
export interface YawSample {
  value: number;
  quality: number;
  valid: boolean;
}

export function estimateYawProxy(landmarks: Landmark[] | null): YawSample {
  const s = estimateHeadPose(landmarks);
  return { value: s.yaw, quality: s.quality, valid: s.valid };
}