import { HEAD_RANGE_CALIBRATION, type HeadDirection } from "@/config/coaching";

/**
 * Pure checks behind the gated head-range calibration: has the person's head
 * actually moved the way the prompt asks? No React and no camera here, so the
 * rules are unit-tested. Thresholds live in `HEAD_RANGE_CALIBRATION.detect`.
 *
 * Measurements come from `estimateHeadPose` (lib/vision): unitless proxies, not
 * angles. Each position is judged against the person's own center pose.
 */
export interface PoseReading {
  yaw: number;
  pitch: number;
  /** A face was found with usable quality. */
  valid: boolean;
}

export interface Neutral {
  yaw: number;
  pitch: number;
}

const DETECT = HEAD_RANGE_CALIBRATION.detect;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** The person's center pose: the median of the readings taken while they looked at the screen. */
export function neutralFrom(readings: PoseReading[]): Neutral | null {
  const usable = readings.filter((r) => r.valid);
  if (usable.length === 0) return null;
  return { yaw: median(usable.map((r) => r.yaw)), pitch: median(usable.map((r) => r.pitch)) };
}

/** Change from the center pose, signed so that positive = toward the named direction. */
export function movementToward(direction: HeadDirection, reading: PoseReading, neutral: Neutral): number {
  const dyaw = reading.yaw - neutral.yaw;
  const dpitch = reading.pitch - neutral.pitch;
  switch (direction) {
    case "left":
      return dyaw * DETECT.yawLeftSign;
    case "right":
      return -dyaw * DETECT.yawLeftSign;
    case "up":
      return dpitch * DETECT.pitchUpSign;
    case "down":
      return -dpitch * DETECT.pitchUpSign;
    case "center":
      return 0;
  }
}

/** True while the head is in the requested position. Center only needs a visible face. */
export function isDirectionMet(direction: HeadDirection, reading: PoseReading | null, neutral: Neutral | null): boolean {
  if (!reading || !reading.valid) return false;
  if (direction === "center") return true;
  if (!neutral) return false;
  const needed = direction === "left" || direction === "right" ? DETECT.yawDelta : DETECT.pitchDelta;
  return movementToward(direction, reading, neutral) >= needed;
}
