import type { ReactNode } from "react";

/**
 * The ochre-ruled marginal note used for privacy statements (PRD §4.4).
 * Owner: Design System team. Defaults to the standard on-device line.
 */
export const DEFAULT_PRIVACY_COPY =
  "Processed on your device. Nothing is uploaded; the camera turns on only when you start a session.";

export function PrivacyNote({ children = DEFAULT_PRIVACY_COPY, className = "" }: { children?: ReactNode; className?: string }) {
  return <p className={`border-l-2 border-ochre pl-3.5 font-serif italic text-text-muted ${className}`}>{children}</p>;
}
