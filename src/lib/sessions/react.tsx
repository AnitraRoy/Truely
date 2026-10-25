/**
 * React bindings for the session controller. Person 1 uses ONLY these in the UI.
 *
 *   // app/layout.tsx (client wrapper)
 *   <SessionProvider controller={controller}>{children}</SessionProvider>
 *
 *   // any screen
 *   const s = useSession();               // live snapshot, re-renders on change
 *   const c = useSessionController();     // call c.startSession(), c.pause(), …
 */

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { SessionController, SessionSnapshot } from "./sessionController";

const Ctx = createContext<SessionController | null>(null);

export function SessionProvider({ controller, children }: { controller: SessionController; children: ReactNode }) {
  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}

export function useSessionController(): SessionController {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessionController must be used inside <SessionProvider>");
  return c;
}

export function useSession(): SessionSnapshot {
  const c = useSessionController();
  return useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
}

/** Matches `PreviewState` in components/useWebcamPreview, so <WebcamFrame state={…}> works unchanged. */
export type CameraPreviewState = "off" | "requesting" | "live" | "denied" | "busy" | "unavailable";

/**
 * Drop-in replacement for `useWebcamPreview` on screens that run a session.
 * The pipeline owns the ONE camera stream; this just shows it. Do not also call
 * getUserMedia from the screen: two openers fight over the device.
 *
 *   const { videoRef, state } = useCameraPreview();   // enable/disable → c.startCamera()/c.stopCamera()
 */
export function useCameraPreview(): { videoRef: React.RefObject<HTMLVideoElement>; state: CameraPreviewState } {
  const controller = useSessionController();
  const s = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const stream = s.cameraActive ? controller.getVisionStream() : null;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) void v.play?.().catch(() => undefined);
  }, [s.cameraActive, controller]);

  const kind = s.error?.kind;
  const state: CameraPreviewState = s.cameraActive
    ? "live"
    : kind === "camera_denied"
      ? "denied"
      : kind === "camera_busy"
        ? "busy"
        : kind === "no_device" || kind === "vision_init" || kind === "camera_lost"
          ? "unavailable"
          : "off";
  return { videoRef, state };
}
