import type { RefObject } from "react";
import type { PreviewState } from "@/components/useWebcamPreview";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { StepHeading } from "./StepHeading";

/**
 * Step 4: camera permission through a clear user action (PRD §6 Screen B).
 * Denied and no-device states say what to do next and offer a retry. A busy
 * camera retries on its own; the steps to share it show under the preview.
 */
const STATUS: Record<PreviewState, { tone: "positive" | "muted" | "warning"; text: string }> = {
  off: { tone: "muted", text: "camera off" },
  requesting: { tone: "muted", text: "waiting for permission" },
  live: { tone: "positive", text: "camera on, local only" },
  denied: { tone: "warning", text: "camera blocked" },
  busy: { tone: "warning", text: "camera in use by another app" },
  unavailable: { tone: "warning", text: "no camera found" },
};

export function CameraStep({
  headingRef,
  state,
  onEnable,
  onDisable,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  state: PreviewState;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const { tone, text } = STATUS[state];
  return (
    <div>
      <StepHeading headingRef={headingRef} size="md">
        Turn on your camera
      </StepHeading>
      <p className="mt-3 text-text-muted">
        The preview is a mirror for you. Frames are read in this browser and never uploaded.
      </p>

      <div className="mt-5">
        <Pill tone={tone}>{text}</Pill>
      </div>

      {state === "denied" && (
        <p className="mt-4 text-[15px] text-text-muted">
          Your browser blocked the camera. Open the camera or lock icon in the address bar, allow camera
          access for this site, then try again.
        </p>
      )}
      {state === "unavailable" && (
        <p className="mt-4 text-[15px] text-text-muted">
          truely. couldn&apos;t find a camera. Connect one, then try again.
        </p>
      )}

      <div className="mt-6">
        {state === "live" ? (
          <Button variant="ghost" onClick={onDisable}>
            Turn camera off
          </Button>
        ) : state === "busy" ? (
          <Button variant="ghost" onClick={onDisable}>
            Stop waiting for the camera
          </Button>
        ) : (
          <Button onClick={onEnable} disabled={state === "requesting"}>
            {state === "denied" || state === "unavailable" ? "Try again" : "Turn on camera"}
          </Button>
        )}
      </div>
    </div>
  );
}
