import type { ReactNode } from "react";

/**
 * The ochre-ruled marginal note used for privacy statements (PRD §4.4).
 * Owner: Design System team. Defaults to the standard on-device line.
 */
export const DEFAULT_PRIVACY_COPY =
  "Camera frames are processed on your device and never uploaded. Voice features send your speech and transcript to the speech and language providers only while you use them.";

export function PrivacyNote({ children = DEFAULT_PRIVACY_COPY, className = "" }: { children?: ReactNode; className?: string }) {
  return <p className={`border-l-2 border-ochre-mark pl-3.5 font-serif italic text-text-muted ${className}`}>{children}</p>;
}
