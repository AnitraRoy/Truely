import { useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into the always-on-top window from useFloatingOverlay().
 * The body gets the app's paper + ink so the window reads as the same journal.
 * Owner: Design System team.
 */
export function FloatingOverlay({ target, children }: { target: Window; children: ReactNode }) {
  useLayoutEffect(() => {
    target.document.body.className = "m-0 bg-bg text-text-primary";
  }, [target]);
  return createPortal(children, target.document.body);
}
