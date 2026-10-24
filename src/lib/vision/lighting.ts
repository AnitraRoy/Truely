
import type { FaceBox } from "./headPose";

// Initial thresholds; tune them on the demo laptop and in the demo room.
export const LIGHTING_CONSTANTS = {
  tooDarkLuma: 45,
  tooBrightLuma: 225,
  sampleSize: 24,
} as const;

export type LightingIssue = "too_dark" | "too_bright";

export function classifyLuma(
  meanLuma: number
): LightingIssue | null {
  if (meanLuma < LIGHTING_CONSTANTS.tooDarkLuma) {
    return "too_dark";
  }
  if (meanLuma > LIGHTING_CONSTANTS.tooBrightLuma) {
    return "too_bright";
  }
  return null;
}

export interface LightingResult {
  meanLuma: number;
  issue: LightingIssue | null;
}

/** Measures brightness within the detected face region. */
export class LightingProbe {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  constructor() {
    const n = LIGHTING_CONSTANTS.sampleSize;
    this.canvas = document.createElement("canvas");
    this.canvas.width = n;
    this.canvas.height = n;
    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
  }

  /** Returns null when brightness cannot be measured. */
  measure(
    video: HTMLVideoElement,
    box: FaceBox
  ): LightingResult | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!this.ctx || vw === 0 || vh === 0) {
      return null;
    }

    const sx = box.x0 * vw;
    const sy = box.y0 * vh;
    const sw = (box.x1 - box.x0) * vw;
    const sh = (box.y1 - box.y0) * vh;

    if (sw < 2 || sh < 2) {
      return null;
    }

    const n = LIGHTING_CONSTANTS.sampleSize;
    this.ctx.drawImage(
      video, sx, sy, sw, sh, 0, 0, n, n
    );

    const { data } = this.ctx.getImageData(
      0, 0, n, n
    );

    let sum = 0;

    for (let i = 0; i < data.length; i += 4) {
      sum +=
        0.2126 * (data[i] ?? 0) +
        0.7152 * (data[i + 1] ?? 0) +
        0.0722 * (data[i + 2] ?? 0);
    }

    const meanLuma = sum / (n * n);

    return {
      meanLuma,
      issue: classifyLuma(meanLuma),
    };
  }
}
