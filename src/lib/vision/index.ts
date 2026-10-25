
/**
 * Vision module (PRD §9, §7.1).
 * Loads MediaPipe lazily and processes webcam frames locally.
 */

import type { VisionFrame } from "@/types";
import {
  createLandmarker,
  detectLandmarks,
  type Landmarker,
} from "./landmarkerService";
import { estimateYawProxy } from "./headPose";

export interface VisionEngine {
  /** Load models only after the user requests webcam features. */
  init(): Promise<void>;

  /** Analyze one video frame; returns null if not ready. */
  process(
    video: HTMLVideoElement,
    timestamp: number
  ): VisionFrame | null;

  /** Release model resources. */
  dispose(): void;
}

export function createVisionEngine(): VisionEngine {
  let landmarker: Landmarker | null = null;
  let disposed = false;

  return {
    async init(): Promise<void> {
      if (landmarker) return;

      disposed = false;
      landmarker = await createLandmarker();
    },

    process(
      video: HTMLVideoElement,
      timestamp: number
    ): VisionFrame | null {
      if (
        disposed ||
        !landmarker ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return null;
      }

      const landmarks = detectLandmarks(
        landmarker,
        video,
        timestamp
      );

      if (!landmarks) {
        return {
          timestamp,
          faceDetected: false,
          trackingConfidence: 0,
        };
      }

      const yawSample = estimateYawProxy(landmarks);

      return {
        timestamp,
        faceDetected: yawSample.valid,
        trackingConfidence: yawSample.quality,
      };
    },

    dispose(): void {
      disposed = true;
      landmarker?.close();
      landmarker = null;
    },
  };
}

// Public landmarker helpers
export { createLandmarker, detectLandmarks } from "./landmarkerService";
export type { Landmarker, LandmarkerOptions } from "./landmarkerService";

// Head-pose estimation and movement helpers
export {
  estimateHeadPose,
  estimateYawProxy,
  headMotionSpeed,
  HEAD_POSE_CONSTANTS,
} from "./headPose";

export type {
  Landmark,
  FaceBox,
  HeadPoseSample,
  PoseAnchor,
  PoseIssue,
  TrackingIssue,
  YawSample,
} from "./headPose";

// Lighting assessment
export {
  LightingProbe,
  classifyLuma,
  LIGHTING_CONSTANTS,
} from "./lighting";

export type {
  LightingIssue,
  LightingResult,
} from "./lighting";
