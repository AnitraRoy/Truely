/**
 * vision module (PRD §9, §7.1)
 * Owner: Computer-Vision team.
 *
 * Responsibilities:
 *  - Load the face-landmark model (MediaPipe Face Landmarker) lazily.
 *  - Process frames from a MediaStream into head-orientation estimates.
 *  - Report tracking confidence and detection failures.
 *
 * Keep this replaceable: the rest of the app only sees `VisionFrame`,
 * so the CV engine can be swapped without touching the UI (PRD §9).
 */

import type { VisionFrame } from "@/types";

export interface VisionEngine {
  /** Load models. Call only after the user requests webcam features (§13). */
  init(): Promise<void>;
  /** Analyze one video frame; returns null if not ready. */
  process(video: HTMLVideoElement, timestamp: number): VisionFrame | null;
  dispose(): void;
}

// TODO(cv-team): implement with @mediapipe/tasks-vision FaceLandmarker.
export function createVisionEngine(): VisionEngine {
  throw new Error("vision.createVisionEngine not implemented");
}
