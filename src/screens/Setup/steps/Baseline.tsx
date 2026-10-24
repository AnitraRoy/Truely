import type { RefObject } from "react";
import { COACHING_CONFIG } from "@/config/coaching";
import { Button } from "@/components/Button";
import { StepHeading } from "./StepHeading";

/**
 * Step 5: draw the baseline (PRD §6 Screen B step 3). No fabricated precision.
 * The personalization engine will confirm at COACHING_CONFIG.minCalibrationSamples;
 * until it lands, the person confirms when ready (same as /calibrate).
 */
export type BaselinePhase = "setup" | "calibrating" | "ready";

const SECONDS = Math.round(COACHING_CONFIG.calibrationDurationMs / 1000);

export function BaselineStep({
  headingRef,
  phase,
  cameraLive,
  onBegin,
  onReady,
  onStartSession,
  onDashboard,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  phase: BaselinePhase;
  cameraLive: boolean;
  onBegin: () => void;
  onReady: () => void;
  onStartSession: () => void;
  onDashboard: () => void;
}) {
  if (phase === "calibrating") {
    return (
      <div>
        <StepHeading headingRef={headingRef} size="md">
          Observing…
        </StepHeading>
        <p className="mt-3 text-text-muted">
          Keep talking as you normally would. Glancing away while you think is fine; Cue is learning what
          your normal looks like.
        </p>
        <div className="mt-6">
          <Button onClick={onReady}>My baseline is ready</Button>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div>
        <StepHeading headingRef={headingRef} size="md">
          Your baseline is ready.
        </StepHeading>
        <p className="mt-3 text-text-muted">
          Cue will use your normal patterns to personalize feedback. You can recalibrate any time.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Button onClick={onStartSession}>Start session</Button>
          <Button variant="ghost" onClick={onDashboard}>
            Go to your journal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepHeading headingRef={headingRef} size="md">
        Draw your baseline
      </StepHeading>
      <p className="mt-3 text-text-muted">
        Speak naturally for about {SECONDS} seconds: introduce yourself, or describe your day. You don&apos;t
        need to hold eye contact.
      </p>
      <div className="mt-6">
        <Button onClick={onBegin} disabled={!cameraLive}>
          Begin calibration
        </Button>
        {!cameraLive && (
          <p className="mt-2 text-[14.5px] text-text-muted">Go back and turn on your camera first.</p>
        )}
      </div>
    </div>
  );
}
