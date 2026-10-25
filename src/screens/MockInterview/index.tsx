import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { CheckChips, SelectField, TextField } from "@/components/Field";
import { ServiceNotice } from "@/components/ServiceNotice";
import { SettingRow } from "@/components/SettingRow";
import { SectionTitle, Sheet } from "@/components/Sheet";
import { Toggle } from "@/components/Toggle";
import { hasDesktopBridge, useServiceStatus } from "@/components/useServiceStatus";
import {
  DEFAULT_PRACTICE_GOALS,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_QUESTION_COUNT,
  INTERVIEW_TYPES,
  type InterviewDifficulty,
} from "@/config/conversation";
import { answerSuggestions, interviewerTurn } from "@/lib/conversation";
import { reportHref } from "@/state/history";
import { useProfileStore } from "@/state/profileStore";
import type { TranscriptSegment } from "@/types";
import { DEV_INTERVIEW_TURNS } from "../practice/devScript";
import { finishConversation, goalsFrom } from "../practice/finishSession";
import { MeetingStage } from "../practice/MeetingStage";
import { useTurnTaking } from "../practice/useTurnTaking";
import { usePracticeCamera } from "../practice/useCameraCoaching";
import { usePracticeCues } from "../practice/usePracticeCues";

/**
 * 04 · Mock interviews (Stage 3: Practice). Private Field Journal.
 * Configure a scenario, then a two-way spoken interview in the call room
 * (MeetingStage): Moss plays the interviewer, Cartesia speaks its questions
 * (captioned as they are spoken) and transcribes the answers, and Space starts
 * and stops each answer. The interviewer never coaches; after each answer Cue
 * itself adds up to two private suggestions about it (answerSuggestions),
 * shown in the overlay and kept for the report.
 * Focal point (running): the interviewer's speaker tile.
 */
type Mode = "live" | "sample";

export function MockInterview() {
  // Bumping the key remounts the screen, which resets it to its setup form.
  const [run, setRun] = useState(0);
  return <MockInterviewSession key={run} onReset={() => setRun((r) => r + 1)} />;
}

function MockInterviewSession({ onReset }: { onReset: () => void }) {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.communicationProfile);
  const services = useServiceStatus();
  const desktop = hasDesktopBridge();
  const goalOptions = goalsFrom(profile, DEFAULT_PRACTICE_GOALS);

  const [type, setType] = useState<string>(INTERVIEW_TYPES[0]);
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("realistic");
  const [goals, setGoals] = useState<string[]>(goalOptions.slice(0, 2));
  const [record, setRecord] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [question, setQuestion] = useState(0);
  const [ending, setEnding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const sampleTurn = useRef(0);

  const cues = usePracticeCues({ enabled: mode === "live", profile, goals });
  const { suggestions, setSuggestions, feedback } = cues;
  const voice = mode === "live" && Boolean(services?.cartesia);
  const turn = useTurnTaking({ speakerLabel: "Interviewer", aiRole: "interviewer", voice, onAnswerProgress: cues.progress });
  cues.question.current = [...turn.transcript].reverse().find((s) => s.role === "interviewer")?.text ?? "";
  const camera = usePracticeCamera();
  const running = mode != null;
  const finished = question > INTERVIEW_QUESTION_COUNT;
  const missing = services ? (["moss", "cartesia"] as const).filter((s) => !services[s]) : [];
  const difficultyLabel = INTERVIEW_DIFFICULTIES.find((d) => d.value === difficulty)!.label;

  async function ask(transcript: TranscriptSegment[], m: Mode, n: number) {
    setQuestion(n);
    const text =
      m === "sample"
        ? DEV_INTERVIEW_TURNS[Math.min(sampleTurn.current++, DEV_INTERVIEW_TURNS.length - 1)]
        : await interviewerTurn({ type, role, difficulty: difficultyLabel, goals, transcript, questionNumber: n });
    if (!text) {
      turn.setError("The interviewer couldn't respond just now. Answer again, or finish the interview.");
      turn.setStatus("your-turn");
      return;
    }
    await turn.aiSays(text);
  }

  async function begin(m: Mode) {
    setMode(m);
    // Camera first, so the recording can include it.
    const video = await camera.open();
    const ok = await turn.start({ record, voice: m === "live" && Boolean(services?.cartesia), video });
    if (!ok) {
      await camera.close(Date.now());
      setMode(null);
      return;
    }
    turn.setStatus("thinking");
    await ask([], m, 1);
  }

  /** Cue's private notes on the answer just given. Runs beside the next question, never delays it. */
  async function suggestAbout(transcript: TranscriptSegment[]) {
    const answer = transcript[transcript.length - 1];
    const asked = [...transcript].reverse().find((s) => s.role === "interviewer");
    if (!answer || answer.role !== "you" || !asked) return;
    const found = await answerSuggestions({
      question: asked.text,
      answer: answer.text,
      interview: `${type.toLowerCase()}${role ? ` for ${role}` : ""}`,
      profile,
      goals,
      previous: feedback.current.map((f) => f.title),
    });
    cues.add(found, answer.startMs, answer.id);
  }

  /** Space / Answer: start the answer, watched for cues as it's spoken. */
  function beginAnswer() {
    cues.beginAnswer(turn.now());
    turn.beginAnswer();
  }

  async function answered(transcript: TranscriptSegment[] | null) {
    if (!transcript || !mode) return;
    cues.settle(transcript);
    if (mode === "live") void suggestAbout(transcript);
    const last = mode === "sample" ? sampleTurn.current >= DEV_INTERVIEW_TURNS.length - 1 : question >= INTERVIEW_QUESTION_COUNT;
    await ask(transcript, mode, last ? INTERVIEW_QUESTION_COUNT + 1 : question + 1);
  }

  async function finish() {
    setEnding(true);
    const done = await turn.end();
    const cam = await camera.close(done.startedAt);
    if (mode === "sample") {
      navigate(reportHref("interview", "sample"));
      return;
    }
    const id = await finishConversation({
      kind: "interview",
      title: type,
      goals,
      context: { Role: role || "General", Difficulty: difficultyLabel },
      profile,
      transcript: done.transcript,
      feedback: feedback.current,
      startedAt: done.startedAt,
      endedAt: done.endedAt,
      recording: done.recording,
      behavioralSessionId: cam.sessionId,
      cameraObservations: cam.observations,
    });
    navigate(reportHref("interview", id));
  }

  // Leaving a running interview: release the microphone, drop the unsaved attempt, show the setup form again.
  async function backToSetup() {
    setConfirmLeave(false);
    await turn.end();
    onReset();
  }

  if (!running) {
    return (
      <AppShell art={{ plate: "woodcock", place: "foot" }}>
        <PageHeader
          step="Step 3 of 4: realistic practice"
          title="Rehearse the moments that matter."
          lede="Practise a real scenario with an AI interviewer that listens, follows up, and leaves the feedback for afterwards."
        />
        <div className="mt-10 grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,1fr)]">
          <Sheet aria-labelledby="setup-title" className="px-6 py-7 md:px-9 md:py-9">
            <SectionTitle id="setup-title">Set up your session</SectionTitle>
            <form
              className="mt-6 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (services?.moss) void begin("live");
              }}
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <SelectField label="Interview type" options={INTERVIEW_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
                <TextField label="Role or context" placeholder="Product design internship" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div>
                <p id="difficulty-label" className="text-[14px] font-medium">
                  Difficulty
                </p>
                <p id="difficulty-help" className="mt-0.5 text-[13.5px] text-text-muted">
                  {INTERVIEW_DIFFICULTIES.find((d) => d.value === difficulty)!.detail}
                </p>
                <div className="mt-2.5">
                  <ChoiceGroup
                    name="difficulty"
                    options={INTERVIEW_DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))}
                    value={difficulty}
                    onChange={setDifficulty}
                    labelledBy="difficulty-label"
                    describedBy="difficulty-help"
                  />
                </div>
              </div>
              <CheckChips legend="Practice goals" help="Used in your report afterwards, not during the interview." options={goalOptions} value={goals} onChange={setGoals} />
              <div className="border-t border-border">
                <SettingRow label="Record this interview" helpId="interview-rec-help" help="On by default. Video and audio, kept on this device, so you can replay moments in the report. Turn off to skip it this time.">
                  <Toggle checked={record} onChange={setRecord} label="Record this interview" describedBy="interview-rec-help" />
                </SettingRow>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button type="submit" disabled={!services?.moss}>
                  Start mock interview
                </Button>
                {import.meta.env.DEV && !services?.moss && (
                  <Button variant="ghost" onClick={() => void begin("sample")}>
                    Preview with a sample interviewer (dev only)
                  </Button>
                )}
              </div>
              {services && (
                <ServiceNotice missing={[...missing]} desktop={desktop}>
                  {services.moss && !services.cartesia ? "You can still run the interview by typing your answers." : null}
                </ServiceNotice>
              )}
            </form>
          </Sheet>

          <aside aria-labelledby="expect-title" className="lg:pt-3">
            <SectionTitle id="expect-title">What to expect</SectionTitle>
            <ul className="mt-3 border-t border-border">
              {[
                ["Length", `About ${INTERVIEW_QUESTION_COUNT} questions, 15 to 20 minutes`],
                ["During", "A call with the interviewer: its questions are spoken and captioned. Press Space to answer and again when done, or type. After each answer, Cue adds a private note at the top of your screen."],
                ["After", "A review with selected moments from your answers and a next step to practise."],
                ["Camera", "Once calibrated, Cue watches head and gaze on this device and marks those moments in your review."],
                ["Privacy", "Your speech goes to Cartesia and the transcript to Moss, only during the interview. The recording and camera stay on this device."],
              ].map(([k, v]) => (
                <li key={k} className="border-b border-border py-3">
                  <p className="text-[13px] text-text-muted">{k}</p>
                  <p className="text-[15px]">{v}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <MeetingStage
        title={`Mock interview: ${type}`}
        topic={role || "General role"}
        aiName="Interviewer"
        status={turn.status}
        transcript={turn.transcript}
        aiLevel={turn.aiLevel}
        voice={voice}
        mic={turn.mic}
        error={turn.error}
        sample={mode === "sample"}
        {...camera.stageProps(turn.recording)}
      focus={goals[0]}
      suggestions={suggestions}
      onDismissSuggestion={(id) => setSuggestions((all) => all.filter((x) => x.id !== id))}
        now={turn.now}
        progress={finished ? "Interview complete" : `Question ${Math.min(question, INTERVIEW_QUESTION_COUNT)} of ${INTERVIEW_QUESTION_COUNT}`}
        closed={finished}
        closedHint="The interview is complete."
        endLabel={finished ? "See your review" : "Finish interview"}
        ending={ending}
        onBegin={beginAnswer}
        onFinish={() => void turn.finishAnswer().then(answered)}
        onTyped={(t) => void answered(turn.typedAnswer(t))}
        onEnd={() => void finish()}
        onLeave={() => setConfirmLeave(true)}
        leaveLabel="Back to setup"
      />
      <ConfirmDialog
        open={confirmLeave}
        title="Go back to setup?"
        confirmLabel="Leave without saving"
        onConfirm={() => void backToSetup()}
        onCancel={() => setConfirmLeave(false)}
      >
        This stops the interview and releases your microphone. No report is saved. To keep one, cancel and finish the
        interview instead.
      </ConfirmDialog>
    </>
  );
}
