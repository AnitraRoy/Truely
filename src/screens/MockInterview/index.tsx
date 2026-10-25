import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { CheckChips, SelectField, TextField } from "@/components/Field";
import { LiveTranscript } from "@/components/LiveTranscript";
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
import { interviewerTurn } from "@/lib/conversation";
import { reportHref } from "@/state/history";
import { useProfileStore } from "@/state/profileStore";
import type { TranscriptSegment } from "@/types";
import { DEV_INTERVIEW_TURNS } from "../practice/devScript";
import { finishConversation, goalsFrom } from "../practice/finishSession";
import { TurnControls, TurnStatusLine } from "../practice/TurnControls";
import { useTurnTaking } from "../practice/useTurnTaking";

/**
 * 04 · Mock interviews (Stage 3: Practice). Private Field Journal.
 * Configure a scenario, then a two-way spoken interview: Moss plays the
 * interviewer, Cartesia speaks its questions and transcribes the answers, and
 * the transcript unfolds beside the question. The interviewer never coaches
 * mid-interview; feedback comes in the report afterwards.
 * Focal point (running): the current question.
 */
type Mode = "live" | "sample";

export function MockInterview() {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.communicationProfile);
  const services = useServiceStatus();
  const desktop = hasDesktopBridge();
  const goalOptions = goalsFrom(profile, DEFAULT_PRACTICE_GOALS);

  const [type, setType] = useState<string>(INTERVIEW_TYPES[0]);
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("realistic");
  const [goals, setGoals] = useState<string[]>(goalOptions.slice(0, 2));
  const [record, setRecord] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [question, setQuestion] = useState(0);
  const [ending, setEnding] = useState(false);
  const sampleTurn = useRef(0);

  const voice = mode === "live" && Boolean(services?.cartesia);
  const turn = useTurnTaking({ speakerLabel: "Interviewer", aiRole: "interviewer", voice });
  const running = mode != null;
  const latest = [...turn.transcript].reverse().find((s) => s.role === "interviewer");
  const recording = record && voice;
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
    const ok = await turn.start({ record: record && m === "live" });
    if (!ok) {
      setMode(null);
      return;
    }
    turn.setStatus("thinking");
    await ask([], m, 1);
  }

  async function answered(transcript: TranscriptSegment[] | null) {
    if (!transcript || !mode) return;
    const last = mode === "sample" ? sampleTurn.current >= DEV_INTERVIEW_TURNS.length - 1 : question >= INTERVIEW_QUESTION_COUNT;
    await ask(transcript, mode, last ? INTERVIEW_QUESTION_COUNT + 1 : question + 1);
  }

  async function finish() {
    setEnding(true);
    const done = await turn.end();
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
      feedback: [],
      startedAt: done.startedAt,
      endedAt: done.endedAt,
      recording: done.recording,
    });
    navigate(reportHref("interview", id));
  }

  if (!running) {
    return (
      <AppShell>
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
                <SettingRow label="Record this interview" helpId="interview-rec-help" help="Off by default. Audio only, kept on this device, so you can replay moments in the report.">
                  <Toggle checked={record} onChange={setRecord} label="Record this interview" describedBy="interview-rec-help" disabled={!services?.cartesia} />
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
                ["During", "The interviewer speaks; you answer out loud or by typing. A live transcript follows along."],
                ["After", "A review with selected moments from your answers and a next step to practise."],
                ["Privacy", "Your speech goes to Cartesia and the transcript to Moss, only during the interview."],
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
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border pb-4">
        <div>
          <p className="text-[14px] font-medium">
            Mock interview{mode === "sample" && <span className="ml-2 font-normal text-ochre">sample interviewer</span>}
          </p>
          <p className="text-[14px] text-text-muted">
            {type}
            {role ? `, ${role}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {recording && (
            <p className="flex items-center gap-2 text-[14px]">
              <span aria-hidden className="h-2 w-2 rounded-pill bg-ochre-mark" />
              Recording audio on this device
            </p>
          )}
          <TurnStatusLine status={turn.status} />
        </div>
      </div>

      <div className="mt-8 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section aria-labelledby="question-title">
          <p className="font-mono text-[12.5px] text-text-muted">
            {finished ? "Interview complete" : `Question ${Math.min(question, INTERVIEW_QUESTION_COUNT)} of ${INTERVIEW_QUESTION_COUNT}`}
          </p>
          <h1 id="question-title" className="mt-3 max-w-[30ch] text-balance font-display text-[clamp(26px,3vw,36px)] font-semibold leading-[1.15] tracking-[-0.01em]">
            {latest ? latest.text : <span className="font-serif font-normal italic text-text-muted">The interviewer is getting ready…</span>}
          </h1>

          <div className="mt-9">
            {ending ? (
              <p className="font-serif italic text-text-muted" aria-live="polite">
                Writing your review…
              </p>
            ) : finished ? (
              <Button onClick={() => void finish()}>See your review</Button>
            ) : (
              <TurnControls
                status={turn.status}
                voice={voice}
                mic={turn.mic}
                error={turn.error}
                onBegin={turn.beginAnswer}
                onFinish={() => void turn.finishAnswer().then(answered)}
                onTyped={(t) => void answered(turn.typedAnswer(t))}
              />
            )}
          </div>

          {!finished && !ending && (
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5">
              <Button variant="secondary" onClick={() => void finish()} disabled={turn.status === "listening"}>
                Finish interview
              </Button>
              <p className="text-[13.5px] text-text-muted">Finishing early still gives you a review of what you answered.</p>
            </div>
          )}
        </section>

        <Sheet aria-labelledby="transcript-title" className="px-5 py-6">
          <h2 id="transcript-title" className="text-[14px] font-medium">
            Live transcript
          </h2>
          <LiveTranscript className="mt-4" segments={turn.transcript} label="Live transcript" maxHeight="max-h-[520px]" />
        </Sheet>
      </div>
    </AppShell>
  );
}
