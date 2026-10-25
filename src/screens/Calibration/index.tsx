import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COACHING_CONFIG, HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import { useSessionStore } from "@/state/sessionStore";
import { Masthead } from "@/components/Masthead";
import { Button } from "@/components/Button";
import { GoalPicker } from "@/components/GoalPicker";
import { HeadRangeFloatingTarget, HeadRangePrompt, HeadRangeSteps, useHeadRange } from "@/components/HeadRangeGuide";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { WebcamFrame } from "@/components/WebcamFrame";
import { useFloatingOverlay } from "@/components/useFloatingOverlay";
import { FloatingOverlay } from "@/components/FloatingOverlay";

/**
 * Screen B: Goal selection + calibration (PRD §6 Screen B). Field Journal.
 * Pick one goal → enable the camera → draw a baseline in two parts: head range
 * then natural speech. The preview holds the left column throughout so the
 * directions stay in view. Honest copy only; no fabricated precision or
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
type Phase = "setup" | "range" | "calibrating" | "ready";

const SECONDS = Math.round(COACHING_CONFIG.calibrationDurationMs / 1000);

const HEADING = "font-display text-[clamp(26px,3.4vw,34px)] font-semibold leading-tight";
const PART = "text-[14.5px] text-text-muted";

export function Calibration() {
  const navigate = useNavigate();
  const goal = useSessionStore((s) => s.goal);
  const setGoal = useSessionStore((s) => s.setGoal);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setCalibrated = useSessionStore((s) => s.setCalibrated);
  const { videoRef, state, enable, disable } = useWebcamPreview();
  const [phase, setPhase] = useState<Phase>("setup");
  const target = useFloatingOverlay({ width: 260, height: 150, title: "Cue — look here" });

  const live = state === "live";
  const startSpeaking = () => {
    target.close();
    setPhase("calibrating");
  };
  const range = useHeadRange({ active: phase === "range" && live, onComplete: startSpeaking });

  // Move the floating target to match the current step, only where the desktop
  // shell can actually reposition a window (not Document PiP).
  useEffect(() => {
    if (phase !== "range" || !target.overlayWindow || !target.supportsPositioning) return;
    target.setPosition(HEAD_RANGE_CALIBRATION.steps[range.index].direction);
  }, [phase, range.index, target.overlayWindow, target.supportsPositioning, target.setPosition]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <Masthead size="sm" folio="Set-up: baseline" />

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
                <h2 className={HEADING}>Draw your baseline</h2>
                <p className="mt-3 text-text-muted">
                  Two short parts. First, follow the directions on your preview to look up, down, left and
                  right. Then speak naturally for about {SECONDS} seconds, so Cue can tell your normal from a
                  real, sustained change.
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
              <p className={PART}>Part 1 of 2</p>
              <h2 className={HEADING}>Look around</h2>
              {target.overlayWindow && target.supportsPositioning && (
                <p className="mt-2 italic text-text-muted">
                  A small target will move to the centre of your screen, then each edge — follow it with your eyes
                  and head.
                </p>
              )}
              <div className="mt-3">
                <HeadRangeSteps range={range} onSkip={startSpeaking} />
              </div>
              {!live && <p className="mt-4 text-[14.5px] text-text-muted">The camera is off, so this part is on hold.</p>}
            </section>
          )}

          {phase === "calibrating" && (
            <section>
              <p className={PART}>Part 2 of 2</p>
              <h2 className={HEADING}>Now just talk</h2>
              <p className="mt-3 text-text-muted">
                Keep speaking as you naturally would. Glancing away while you think is fine; Cue is collecting
                your baseline.
              </p>
              {/* The CV/personalization engine confirms at the configured sample count
                  (src/config/coaching.ts). Pending that engine, you confirm when ready. */}
              <div className="mt-6">
                <Button
                  onClick={() => {
                    setCalibrated(true);
                    setStatus("ready");
                    setPhase("ready");
                  }}
                >
                  My baseline is ready
                </Button>
              </div>
            </section>
          )}

          {phase === "ready" && (
            <section>
              <h2 className={HEADING}>Your baseline is ready.</h2>
              <p className="mt-3 text-text-muted">
                Cue will use your normal patterns to personalize feedback. You can recalibrate any time.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate("/session")}>Start session</Button>
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
