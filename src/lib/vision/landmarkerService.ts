
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";
import type { Landmark } from "./headPose";

export type Landmarker = FaceLandmarkerType;

export interface LandmarkerOptions {
  wasmPath?: string;
  modelPath?: string;
}

/** Loads the model using GPU, with CPU fallback. */
export async function createLandmarker(
  opts: LandmarkerOptions = {}
): Promise<Landmarker> {
  const wasmPath = opts.wasmPath ?? "/mediapipe/wasm";
  const modelPath = opts.modelPath ?? "/models/face_landmarker.task";

  const { FaceLandmarker, FilesetResolver } =
    await import("@mediapipe/tasks-vision");

  const fileset = await FilesetResolver.forVisionTasks(wasmPath);

  const make = (delegate: "GPU" | "CPU") =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
    });

  try {
    return await make("GPU");
  } catch {
    return await make("CPU");
  }
}

/** Returns the first face's landmarks, or null if no face is detected. */
export function detectLandmarks(
  landmarker: Landmarker,
  video: HTMLVideoElement,
  nowMs: number
): Landmark[] | null {
  const result = landmarker.detectForVideo(video, nowMs);
  return result.faceLandmarks?.[0] ?? null;
}
