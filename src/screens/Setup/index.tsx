import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Masthead } from "@/components/Masthead";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/Button";
import { WebcamFrame } from "@/components/WebcamFrame";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { HeadRangePrompt, useHeadRange } from "@/components/HeadRangeGuide";
import { useProfileStore } from "@/state/profileStore";
import { useSessionStore } from "@/state/sessionStore";
import { WelcomeStep } from "./steps/Welcome";
import { GoalStep } from "./steps/Goal";
import { SavingStep } from "./steps/Saving";
import { CameraStep } from "./steps/Camera";
import { BaselineStep, type BaselinePhase } from "./steps/Baseline";

/**
 * First-time setup (docs/FRONTEND_GUIDE.md §3.2). Field Journal.
 * Welcome → goal → saving consent → camera → baseline. The camera is never
 * requested before step 4, Back always works, and answers persist as they are
 * given, so leaving mid-way loses nothing. Honest copy only (CLAUDE.md §5).
 */
const STEPS = ["Welcome", "Goal", "Saving", "Camera", "Baseline"];
const CAMERA = 3;
const BASELINE = 4;

export function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<BaselinePhase>("setup");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const goal = useSessionStore((s) => s.goal);
  const setGoal = useSessionStore((s) => s.setGoal);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setCalibrated = useSessionStore((s) => s.setCalibrated);
  const setPrimaryGoal = useProfileStore((s) => s.setPrimaryGoal);
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const setConsent = useProfileStore((s) => s.setConsentSaveMetrics);
  const setSetupComplete = useProfileStore((s) => s.setSetupComplete);

  const camera = useWebcamPreview();
  const live = camera.state === "live";

  // Move focus to the new step's heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const startSpeaking = () => setPhase("calibrating");
  const range = useHeadRange({ active: step === BASELINE && phase === "range" && live, onComplete: startSpeaking });

  const canContinue = step === 1 ? goal != null : step === CAMERA ? live : true;

  const finishBaseline = () => {
    setCalibrated(true);
    setStatus("ready");
    setSetupComplete(true);
    setPhase("ready");
  };

  const stepBody = [
    <WelcomeStep key="welcome" headingRef={headingRef} />,
    <GoalStep
      key="goal"
      headingRef={headingRef}
      goal={goal}
      onChange={(g) => {
        setGoal(g);
        setPrimaryGoal(g);
      }}
    />,
    <SavingStep key="saving" headingRef={headingRef} consent={consent} onChange={setConsent} />,
    <CameraStep key="camera" headingRef={headingRef} state={camera.state} onEnable={camera.enable} onDisable={camera.disable} />,
    <BaselineStep
      key="baseline"
      headingRef={headingRef}
      phase={phase}
      cameraLive={live}
      range={range}
      onBegin={() => {
        setStatus("calibrating");
        setPhase("range");
      }}
      onRangeSkip={startSpeaking}
      onReady={finishBaseline}
      onStartSession={() => navigate("/session")}
      onDashboard={() => navigate("/home")}
    />,
  ][step];

  const usesCamera = step === CAMERA || step === BASELINE;
  const showNav = !(step === BASELINE && phase !== "setup");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <Masthead size="sm" folio="First-time setup" homeHref="/" />

      <div className="mt-8 max-w-md">
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* The preview stays mounted across Camera and Baseline so the stream isn't lost. */}
      <div
        className={`mt-10 grid items-start gap-x-[clamp(24px,4vw,56px)] gap-y-8 ${
          usesCamera ? "md:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]" : ""
        }`}
      >
        <WebcamFrame
          videoRef={camera.videoRef}
          state={camera.state}
          className={usesCamera ? "" : "hidden"}
          overlay={step === BASELINE && phase === "range" ? <HeadRangePrompt range={range} /> : undefined}
        />

        <section className={usesCamera || step === 0 ? "" : "max-w-3xl"}>
          {stepBody}

          {showNav && (
            <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-6">
              {step < BASELINE && (
                <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>
                  Continue
                </Button>
              )}
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {!canContinue && (
                <p className="w-full text-[14.5px] text-text-muted">
                  {step === 1 ? "Choose a goal to continue." : "Turn on your camera to continue."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
