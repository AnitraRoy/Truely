// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSessionController } from "../sessionController";
import { createMemoryStorage } from "@/lib/storage";
import { createScriptedVisionSource, wobble } from "@/lib/vision/scriptedSource";
import type { VisionSource } from "@/lib/vision/types";
import type { VisionFrame } from "@/types";

const START = 1_000_000;
const CAL_MS = 46_000;

function scripted() {
  const vision = createScriptedVisionSource({ scenario: (t) => ({ yaw: 8 + 2 * wobble(t) }), startAt: START });
  const storage = createMemoryStorage();
  const controller = createSessionController({ vision, storage, clock: () => vision.now(), emitIntervalMs: 0 });
  return { vision, storage, controller };
}

describe("camera start/stop races (React StrictMode: mount → unmount → mount)", () => {
  it("start → stop → start ends ON with exactly one frame subscription", async () => {
    const t = scripted();
    const a = t.controller.startCamera();
    t.controller.stopCamera();
    const b = t.controller.startCamera();
    await Promise.all([a, b]);
    expect(t.controller.getSnapshot().cameraActive).toBe(true);
    expect(t.vision.isActive()).toBe(true);
    await t.controller.startCalibration();
    t.vision.pump(1_000); // 10 frames → 10 samples, not 20
    expect(t.controller.getSnapshot().calibration!.validCount).toBe(10);
  });

  it("start → stop ends OFF even if the source finishes starting late (non-serialized source)", async () => {
    let active = false;
    const naive: VisionSource = {
      async start() {
        await new Promise((r) => setTimeout(r, 5));
        active = true;
      },
      stop() { active = false; },
      isActive: () => active,
      onFrame: () => () => {},
    };
    const c = createSessionController({ vision: naive });
    const p = c.startCamera();
    c.stopCamera();
    expect(await p).toBe(false);
    expect(active).toBe(false); // the controller released it again
    expect(c.getSnapshot().cameraActive).toBe(false);
  });

  it("a runtime camera failure releases the camera; the session can still be ended and saved", async () => {
    // A source we can fail on demand.
    let onErr: ((e: Error) => void) | null = null;
    let onFrame: ((f: VisionFrame) => void) | null = null;
    let active = false;
    let now = START;
    const src: VisionSource = {
      async start() { active = true; },
      stop() { active = false; },
      isActive: () => active,
      onFrame(cb) { onFrame = cb; return () => { onFrame = null; }; },
      onError(cb) { onErr = cb; return () => { onErr = null; }; },
    };
    const storage = createMemoryStorage();
    const c = createSessionController({ vision: src, storage, clock: () => now, emitIntervalMs: 0 });
    await c.setSaveConsent(true);
    await c.startCalibration();
    for (; now < START + CAL_MS; now += 100) {
      onFrame!({ timestamp: now, faceDetected: true, trackingConfidence: 0.9, headPose: { yaw: 8 + 2 * wobble(now), pitch: 0, roll: 0 } });
    }
    expect(c.getSnapshot().phase).toBe("calibrated");
    await c.startSession();
    onErr!(new Error("device unplugged"));
    const s = c.getSnapshot();
    expect(s.error?.kind).toBe("camera_lost");
    expect(s.cameraActive).toBe(false);
    expect(active).toBe(false);
    expect(await c.end()).not.toBeNull();
    expect(await storage.listSessions()).toHaveLength(1);
  });
});
