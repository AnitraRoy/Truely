import type { RefObject } from "react";
import { CameraBusyHelp } from "./CameraBusyHelp";
import type { PreviewState } from "./useWebcamPreview";

/**
 * The webcam preview, mounted in the Field Journal plate frame. The preview is
 * the focal element on the Live screen (CLAUDE.md §6) and a mirror of the
 * person themselves — never a subject under inspection (CLAUDE.md §5).
 *
 * When the camera is off/unavailable it shows an honest, actionable placeholder
 * (a flat neutral field), never a generated figure (CLAUDE.md §4A.3). When the
 * camera is busy, the steps to share it appear under the preview.
 */
const MESSAGE: Record<Exclude<PreviewState, "live">, string> = {
  off: "Camera off. Enable it to see your preview.",
  requesting: "Requesting camera…",
  denied: "Camera blocked. Allow access in your browser, then try again.",
  busy: "Another app is using your camera.",
  unavailable: "No camera is available on this device.",
};

export function WebcamFrame({
  videoRef,
  state,
  className = "",
}: {
  videoRef: RefObject<HTMLVideoElement>;
  state: PreviewState;
  className?: string;
}) {
  const live = state === "live";
  return (
    <div className={`relative border border-border bg-surface p-3.5 ${className}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-border">
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          aria-label="Your webcam preview"
          className={`h-full w-full -scale-x-100 object-cover ${live ? "" : "invisible"}`}
        />
        {!live && (
          <p className="absolute inset-0 m-auto flex items-center justify-center px-8 text-center font-serif italic text-text-muted">
            {MESSAGE[state]}
          </p>
        )}
      </div>
      {state === "busy" && (
        <div className="mt-4 px-1 pb-1">
          <CameraBusyHelp />
        </div>
      )}
    </div>
  );
}
