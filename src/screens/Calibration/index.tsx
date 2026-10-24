import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/state/sessionStore";
import { Masthead } from "@/components/Masthead";
import { Button } from "@/components/Button";
import { GoalPicker } from "@/components/GoalPicker";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { WebcamFrame } from "@/components/WebcamFrame";

/**
 * Screen B: Goal selection + calibration (PRD §6 Screen B). Field Journal.
 * Pick one goal → enable the camera → draw a baseline. Honest copy only; no
 * fabricated precision or personality assessment (PRD §6, CLAUDE.md §5).
 */
export function Calibration() {
  const navigate = useNavigate();
  const goal = useSessionStore((s) => s.goal);
  const setGoal = useSessionStore((s) => s.setGoal);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setCalibrated = useSessionStore((s) => s.setCalibrated);
  const { videoRef, state, enable, disable } = useWebcamPreview();
  const [phase, setPhase] = useState<"setup" | "calibrating" | "ready">("setup");

  const live = state === "live";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <Masthead
        size="sm"
        folio={
          <>
            SET-UP
            <br />
            No.&nbsp;001 — baseline
          </>
        }
      />

      {/* Step 1 — goal */}
      <section className="mt-9">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Step 1 · choose a goal</p>
        <h2 id="calibration-goal-heading" className="mt-2 font-display text-[clamp(26px,4vw,38px)] font-semibold leading-tight">
          What would you like to work on?
        </h2>
        <div className="mt-5">
          <GoalPicker value={goal} onChange={setGoal} labelledBy="calibration-goal-heading" />
        </div>
        <p className="mt-3 font-serif italic text-text-muted">
          Looking at the camera all the time isn&apos;t the goal — Cue learns your own normal.
        </p>
      </section>

      {/* Step 2 — camera */}
      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Step 2 · camera</p>
        <h2 className="mt-2 font-display text-[clamp(26px,4vw,38px)] font-semibold leading-tight">Enable your camera</h2>
        <div className="mt-5 grid items-start gap-6 md:grid-cols-[1fr_200px]">
          <WebcamFrame videoRef={videoRef} state={state} />
          <div>
            <p className="flex items-center gap-2 font-mono text-[12px] text-text-muted">
              <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${live ? "bg-positive" : "bg-text-muted"}`} />
              {live ? "Camera on · local only" : "Camera off"}
            </p>
            <p className="mt-3 font-serif text-[14.5px] italic text-text-muted">
              Frames stay on your device — nothing is uploaded.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {live ? (
                <Button variant="ghost" onClick={disable}>Turn camera off</Button>
              ) : (
                <Button onClick={enable}>Enable camera</Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Step 3 — calibration */}
      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Step 3 · baseline</p>
        {phase === "setup" && (
          <>
            <h2 className="mt-2 font-display text-[clamp(26px,4vw,38px)] font-semibold leading-tight">Draw your baseline</h2>
            <p className="mt-3 max-w-[54ch] font-serif text-text-muted">
              Speak naturally for about a minute. Cue notes your typical head orientation and gaze so it
              can tell your normal from a real, sustained change.
            </p>
            <div className="mt-6">
              <Button
                disabled={!goal || !live}
                onClick={() => {
                  setStatus("calibrating");
                  setPhase("calibrating");
                }}
                className={!goal || !live ? "opacity-40" : ""}
              >
                Begin calibration
              </Button>
              {(!goal || !live) && (
                <p className="mt-2 font-mono text-[11px] text-text-muted">
                  Choose a goal and enable the camera first.
                </p>
              )}
            </div>
          </>
        )}

        {phase === "calibrating" && (
          <>
            <h2 className="mt-2 font-display text-[clamp(26px,4vw,38px)] font-semibold leading-tight">Observing…</h2>
            <p className="mt-3 max-w-[54ch] font-serif text-text-muted">
              Keep speaking as you naturally would. Cue is collecting your baseline — it will confirm
              when it has enough.
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
          </>
        )}

        {phase === "ready" && (
          <>
            <h2 className="mt-2 font-display text-[clamp(26px,4vw,38px)] font-semibold leading-tight">Baseline ready</h2>
            <p className="mt-3 max-w-[54ch] font-serif text-text-muted">
              Cue will use your normal patterns to personalize feedback. You can recalibrate any time.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate("/session")}>Start session</Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
