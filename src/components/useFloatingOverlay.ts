import { useCallback, useEffect, useState } from "react";

/**
 * An always-on-top window that floats over whatever the person switches to, so a
 * live session can sit on top of their meeting. Two backends, same portal:
 *
 *  - "desktop": inside the truely. desktop shell (electron/main.cjs), a frameless
 *    window above every app, excluded from screen shares and recordings where the
 *    OS supports it (Windows, macOS), with global shortcuts to hide it or make it
 *    click-through. This is OpenCluely's invisible-overlay technique.
 *  - "pip": in Chrome / Edge 116+, a Document Picture-in-Picture window that
 *    floats over other tabs. It is visible to screen capture.
 *
 * Either way the window shares this page's JS context, so screens render into it
 * with a React portal (<FloatingOverlay>) and the camera stream never leaves the
 * page (PRD §4.4). Opening needs a user gesture (a click).
 * Owner: Design System team.
 */

interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
}

/** Overlay state reported by the desktop shell. */
export interface DesktopOverlayState {
  open: boolean;
  hidden: boolean;
  clickThrough: boolean;
  /** True where the OS honours capture exclusion (Windows, macOS). */
  contentProtected: boolean;
  shortcuts: { toggleHidden: string; toggleClickThrough: string };
}

/**
 * Explicit overlay placements (electron/main.cjs `positionOverlay`): centre of
 * the screen, the four edges, and "camera" (flush with the top centre, nearest
 * a typical webcam). Used for visual calibration, so the person looks at the
 * camera, then up/down/left/right as the window moves.
 */
export type OverlayPosition = "center" | "camera" | "up" | "down" | "left" | "right";

/** Bridge exposed by electron/preload.cjs. Exported for other desktop-aware components. */
export interface CueDesktop {
  overlayName: string;
  getOverlayState(): Promise<DesktopOverlayState>;
  onOverlayState(callback: (state: DesktopOverlayState) => void): () => void;
  /** No-op unless the overlay is open. Desktop shell only — Document PiP has no position API. */
  setOverlayPosition(position: OverlayPosition): Promise<void>;
  /** Opens Windows' Settings › Cameras page (no-op elsewhere). */
  openCameraSettings(): Promise<void>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
    cueDesktop?: CueDesktop;
  }
}

export type OverlayMode = "desktop" | "pip";

/** Root attributes the tokens and motion rules key off (theme.ts, App.tsx). */
const MIRRORED_ATTRS = ["data-theme", "data-motion"];

export function getOverlayMode(): OverlayMode | null {
  if (typeof window === "undefined") return null;
  if (window.cueDesktop) return "desktop";
  if ("documentPictureInPicture" in window) return "pip";
  return null;
}

/** Copy this page's styles (tokens, Tailwind, fonts) into the floating window. */
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules, (r) => r.cssText).join("\n");
      const style = target.createElement("style");
      style.textContent = css;
      target.head.appendChild(style);
    } catch {
      // Cross-origin sheet (Google Fonts): its rules aren't readable, so link it instead.
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

function mirrorRootAttrs(target: Document) {
  for (const name of MIRRORED_ATTRS) {
    const value = document.documentElement.getAttribute(name);
    if (value == null) target.documentElement.removeAttribute(name);
    else target.documentElement.setAttribute(name, value);
  }
}

async function requestWindow(mode: OverlayMode, width: number, height: number): Promise<Window | null> {
  if (mode === "desktop") {
    // The shell recognises this name and turns the window into the protected overlay.
    return window.open("about:blank", window.cueDesktop!.overlayName, `width=${width},height=${height}`);
  }
  const api = window.documentPictureInPicture!;
  if (api.window) return api.window;
  return api.requestWindow({ width, height });
}

export function useFloatingOverlay({ width = 340, height = 345, title = "truely." } = {}) {
  const [overlayWindow, setOverlayWindow] = useState<Window | null>(null);
  const [desktop, setDesktop] = useState<DesktopOverlayState | null>(null);
  const mode = getOverlayMode();

  const open = useCallback(async () => {
    if (!mode) return false;
    if (overlayWindow) {
      overlayWindow.focus();
      return true;
    }
    try {
      const win = await requestWindow(mode, width, height);
      if (!win) return false;
      win.document.title = title;
      win.document.documentElement.lang = document.documentElement.lang;
      copyStyles(win.document);
      mirrorRootAttrs(win.document);
      win.addEventListener("pagehide", () => setOverlayWindow(null), { once: true });
      setOverlayWindow(win);
      return true;
    } catch {
      // No user activation, or the browser declined. The in-tab view keeps working.
      return false;
    }
  }, [mode, overlayWindow, width, height, title]);

  const close = useCallback(() => {
    overlayWindow?.close();
    setOverlayWindow(null);
  }, [overlayWindow]);

  // Desktop only: Document PiP exposes no window-position API, so elsewhere this is a no-op.
  const setPosition = useCallback(
    (position: OverlayPosition) => {
      if (mode === "desktop" && overlayWindow) void window.cueDesktop?.setOverlayPosition(position);
    },
    [mode, overlayWindow],
  );

  // Desktop shell: hidden / click-through come from global shortcuts, and the
  // window can close from the shell's side, so follow its reports.
  useEffect(() => {
    const bridge = window.cueDesktop;
    if (!bridge) return;
    void bridge.getOverlayState().then(setDesktop);
    return bridge.onOverlayState((state) => {
      setDesktop(state);
      if (!state.open) setOverlayWindow(null);
    });
  }, []);

  // Keep theme / reduced-motion in step if the person changes them while floating.
  useEffect(() => {
    if (!overlayWindow) return;
    const observer = new MutationObserver(() => mirrorRootAttrs(overlayWindow.document));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: MIRRORED_ATTRS });
    return () => observer.disconnect();
  }, [overlayWindow]);

  // The overlay belongs to the screen that opened it.
  useEffect(() => () => overlayWindow?.close(), [overlayWindow]);

  return {
    mode,
    supported: mode != null,
    /** True only when positioning actually moves the window (desktop shell, not PiP). */
    supportsPositioning: mode === "desktop",
    overlayWindow,
    desktop,
    open,
    close,
    setPosition,
  };
}
