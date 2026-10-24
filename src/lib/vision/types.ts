/**
 * VisionSource: the seam between the camera/vision layer and the session controller.
 * Person 2's real camera + MediaPipe pipeline and the scripted test source both
 * implement this, so the controller never knows which one it is talking to.
 */
import type { VisionFrame } from "@/types";

export interface VisionSource {
  /** Acquire the camera and begin emitting frames. Throws (with a DOMException-style `name`) on failure. */
  start(): Promise<void>;
  /** Stop emitting frames and release every MediaStream track. Must be safe to call twice. */
  stop(): void;
  isActive(): boolean;
  /** Subscribe to frames. Returns an unsubscribe function. */
  onFrame(cb: (frame: VisionFrame) => void): () => void;
  /** Optional: subscribe to unexpected failures (e.g. camera unplugged mid-session). */
  onError?(cb: (error: Error) => void): () => void;
  /** Optional: the live stream, for <video>.srcObject. Null for non-camera sources. */
  getStream?(): MediaStream | null;
}