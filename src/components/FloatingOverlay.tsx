import { useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into the always-on-top window from useFloatingOverlay().
 * The body stays transparent — the desktop window itself is fully transparent
 * (electron/main.cjs), so SessionOverlay's own rounded, slightly-translucent
 * panel is what gives the window its shape and fill, not an opaque body.
 * Owner: Design System team.
 */
export function FloatingOverlay({ target, children }: { target: Window; children: ReactNode }) {
  useLayoutEffect(() => {
    target.document.documentElement.className = "bg-transparent";
    target.document.body.className = "m-0 bg-transparent text-text-primary";
  }, [target]);
  return createPortal(children, target.document.body);
}
