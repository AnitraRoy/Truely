import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import { useSessionStore } from "@/state/sessionStore";
import { useProfileStore } from "@/state/profileStore";
import { Masthead } from "@/components/Masthead";
import { Button } from "@/components/Button";
import { GoalPicker } from "@/components/GoalPicker";
import { HeadRangeFloatingTarget, HeadRangePrompt, HeadRangeSteps, useHeadRange } from "@/components/HeadRangeGuide";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { useHeadPose } from "@/components/useHeadPose";
import { BackButton } from "@/components/BackButton";
import { WebcamFrame } from "@/components/WebcamFrame";
import { useFloatingOverlay } from "@/components/useFloatingOverlay";
import { FloatingOverlay } from "@/components/FloatingOverlay";

/**
 * Screen B: Goal selection + calibration (PRD §6 Screen B). Field Journal.
 * Pick one goal → enable the camera → draw the camera baseline from head range
 * (look up, down, left, right). There is no speech sample: how the person
 * wants to sound is their desired style (Communication profile), which they
 * set themselves, so the ready state hands off there. The preview holds the
 * left column throughout so the directions stay in view. Honest copy only; no fabricated precision or
 * personality assessment (PRD §6, CLAUDE.md §5).
 *
 * Where the desktop shell can actually move a window (`supportsPositioning` —
 * not Document PiP, which has no position API), the head-range part also
 * floats a small target to the centre of the screen, then each edge, so the
 * person looks straight ahead and then up/down/left/right at a real
 * on-screen point rather than an arrow drawn over their own preview. The
 * preview's directions (`HeadRangePrompt`) stay up the whole time regardless,
 * so nothing is lost where positioning isn't available.
 */
type Phase = "setup" | "range" | "ready";

const HEADING = "font-display text-[clamp(26px,3.4vw,34px)] font-semibold leading-tight";

export function Calibration() {
  const navigate = useNavigate();
  const goal = useSessionStore((s) => s.goal);
  const setGoal = useSessionStore((s) => s.setGoal);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setCalibrated = useSessionStore((s) => s.setCalibrated);
  const hasStyle = useProfileStore((s) => Boolean(s.communicationProfile?.traits.some((t) => t.keep)));
  const { videoRef, state, enable, disable } = useWebcamPreview();
  const [phase, setPhase] = useState<Phase>("setup");
  const target = useFloatingOverlay({ width: 260, height: 150, title: "Cue — look here" });

  const live = state === "live";
  // The pending CV/personalization engine confirms at the configured sample
  // count (src/config/coaching.ts); until then, finishing head range completes it.
  const finishBaseline = () => {
    target.close();
    setCalibrated(true);
    setStatus("ready");
    setPhase("ready");
  };
  const rangeActive = phase === "range" && live;
  // Each position only counts once the person's head has actually moved that way.
  const tracker = useHeadPose(videoRef, rangeActive);
  const range = useHeadRange({ active: rangeActive, onComplete: finishBaseline, tracker });

  // Back from the head-range or ready parts returns to the start of the baseline.
  const backToStart = () => {
    target.close();
    range.restart();
    setStatus("ready");
    setPhase("setup");
  };

  // Move the floating target to match the current step, only where the desktop
  // shell can actually reposition a window (not Document PiP).
  useEffect(() => {
    if (phase !== "range" || !target.overlayWindow || !target.supportsPositioning) return;
    target.setPosition(HEAD_RANGE_CALIBRATION.steps[range.index].direction);
  }, [phase, range.index, target.overlayWindow, target.supportsPositioning, target.setPosition]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <Masthead size="sm" folio="Set-up: baseline" />

      <div className="mt-6">
        {phase === "setup" ? <BackButton fallback="/home" /> : <BackButton fallback="/home" onBack={backToStart} />}
      </div>

      <div className="mt-10 grid items-start gap-x-[clamp(24px,4vw,56px)] gap-y-8 md:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="md:sticky md:top-8">
          <WebcamFrame
            videoRef={videoRef}
            state={state}
            overlay={phase === "range" ? <HeadRangePrompt range={range} /> : undefined}
          />
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="flex items-center gap-2 text-[14.5px] text-text-muted">
              <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${live ? "bg-positive" : "bg-text-muted"}`} />
              {live ? "Camera on, local only. Frames are never uploaded." : "Camera off"}
            </p>
            {live ? (
              <Button variant="ghost" size="sm" onClick={disable}>
                Turn camera off
              </Button>
            ) : (
              <Button size="sm" onClick={enable} disabled={state === "requesting"}>
                Enable camera
              </Button>
            )}
          </div>
        </div>

        <div>
          {phase === "setup" && (
            <>
              <section>
                <h2 id="calibration-goal-heading" className={HEADING}>
                  What would you like to work on?
                </h2>
                <div className="mt-5">
                  <GoalPicker value={goal} onChange={setGoal} labelledBy="calibration-goal-heading" />
                </div>
                <p className="mt-3 italic text-text-muted">
                  Looking at the camera all the time isn&apos;t the goal. Cue learns your own normal.
                </p>
              </section>

              <section className="mt-10 border-t border-border pt-8">
                <h2 className={HEADING}>Draw your camera baseline</h2>
                <p className="mt-3 text-text-muted">
                  Follow the directions on your preview to look up, down, left and right. It takes under a
                  minute, and lets Cue tell your normal from a real, sustained change.
                </p>
                <p className="mt-2 text-[14.5px] text-text-muted">
                  You won&apos;t be asked to talk. How you want to sound comes from your desired style, which you
                  set yourself.
                </p>
                <div className="mt-6">
                  <Button
                    disabled={!goal || !live}
                    onClick={async () => {
                      setStatus("calibrating");
                      if (target.supportsPositioning) await target.open();
                      setPhase("range");
                    }}
                  >
                    Begin calibration
                  </Button>
                  {(!goal || !live) && (
                    <p className="mt-2 text-[14.5px] text-text-muted">Choose a goal and enable the camera first.</p>
                  )}
                </div>
              </section>
            </>
          )}

          {phase === "range" && (
            <section>
              <h2 className={HEADING}>Look around</h2>
              {target.overlayWindow && target.supportsPositioning && (
                <p className="mt-2 italic text-text-muted">
                  A small target will move to the centre of your screen, then each edge — follow it with your eyes
                  and head.
                </p>
              )}
              <div className="mt-3">
                <HeadRangeSteps range={range} onSkip={finishBaseline} />
              </div>
              {!live && <p className="mt-4 text-[14.5px] text-text-muted">The camera is off, so this part is on hold.</p>}
            </section>
          )}

          {phase === "ready" && (
            <section>
              <h2 className={HEADING}>Your camera baseline is ready.</h2>
              <p className="mt-3 text-text-muted">
                Cue will compare your head and gaze to your own normal, not a generic standard. You can recalibrate any
                time.
              </p>
              <p className="mt-3 text-text-muted">
                {hasStyle
                  ? "For how you sound, Cue coaches toward the desired style you chose."
                  : "For how you sound, Cue coaches toward a desired style that you choose. You haven't set one yet."}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                {hasStyle ? (
                  <>
                    <Button onClick={() => navigate("/session")}>Start session</Button>
                    <Button variant="ghost" onClick={() => navigate("/profile?tab=style")}>
                      Review your desired style
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => navigate("/profile?tab=style")}>Set your desired style</Button>
                    <Button variant="ghost" onClick={() => navigate("/session")}>
                      Start a session without one
                    </Button>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {phase === "range" && target.overlayWindow && (
        <FloatingOverlay target={target.overlayWindow}>
          <HeadRangeFloatingTarget range={range} />
        </FloatingOverlay>
      )}
    </main>
  );
}
