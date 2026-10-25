import type { RefObject } from "react";
import { Button } from "@/components/Button";
import { HeadRangeSteps, type HeadRange } from "@/components/HeadRangeGuide";
import { useProfileStore } from "@/state/profileStore";
import { StepHeading } from "./StepHeading";

/**
 * Step 5: draw the camera baseline (PRD §6 Screen B step 3) from head range:
 * look up, down, left, right, guided on the preview. The person is not asked
 * to talk: how they want to sound is their desired style, which they set on
 * the Communication profile, so the ready state hands off there.
 * No fabricated precision. The personalization engine will confirm at
 * COACHING_CONFIG.minCalibrationSamples; until it lands, finishing (or
 * skipping) head range completes the baseline (same as /calibrate).
 */
export type BaselinePhase = "setup" | "range" | "ready";

export function BaselineStep({
  headingRef,
  phase,
  cameraLive,
  range,
  onBegin,
  onRangeSkip,
  onDesiredStyle,
  onStartSession,
  onDashboard,
  onBack,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  phase: BaselinePhase;
  cameraLive: boolean;
  range: HeadRange;
  onBegin: () => void;
  onRangeSkip: () => void;
  onDesiredStyle: () => void;
  onStartSession: () => void;
  onDashboard: () => void;
  /** Step back to the start of the baseline (restarts the head-range part). */
  onBack?: () => void;
}) {
  const hasStyle = useProfileStore((s) => Boolean(s.communicationProfile?.traits.some((t) => t.keep)));

  if (phase === "range") {
    return (
      <div>
        <StepHeading headingRef={headingRef} size="md">
          Look around
        </StepHeading>
        <div className="mt-3">
          <HeadRangeSteps range={range} onSkip={onRangeSkip} />
        </div>
        {onBack && (
          <div className="mt-6 border-t border-border pt-5">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        )}
        {!cameraLive && (
          <p className="mt-4 text-[14.5px] text-text-muted">The camera is off, so this part is on hold.</p>
        )}
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div>
        <StepHeading headingRef={headingRef} size="md">
          Your camera baseline is ready.
        </StepHeading>
        <p className="mt-3 text-text-muted">
          truely. will compare your head and gaze to your own normal. You can recalibrate any time.
        </p>
        <p className="mt-3 text-text-muted">
          {hasStyle
            ? "For how you sound, truely. coaches toward the desired style you chose."
            : "For how you sound, there's no recording of you to compare against. Instead, you choose a desired style: a speaker or talk you admire, and the patterns you want to practise."}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          {hasStyle ? (
            <Button onClick={onStartSession}>Start session</Button>
          ) : (
            <Button onClick={onDesiredStyle}>Set your desired style</Button>
          )}
          <Button variant="ghost" onClick={onDashboard}>
            Go to your journal
          </Button>
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepHeading headingRef={headingRef} size="md">
        Draw your camera baseline
      </StepHeading>
      <p className="mt-3 text-text-muted">
        Follow the directions above your preview to look up, down, left and right. It takes under a minute. You
        don&apos;t need to hold eye contact, and you won&apos;t be asked to talk.
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
