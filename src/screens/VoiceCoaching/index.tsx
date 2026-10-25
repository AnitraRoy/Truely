import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { CheckChips } from "@/components/Field";
import { LiveTranscript } from "@/components/LiveTranscript";
import { SettingRow } from "@/components/SettingRow";
import { ServiceNotice } from "@/components/ServiceNotice";
import { SectionTitle, Sheet } from "@/components/Sheet";
import { SuggestionNote } from "@/components/SuggestionNote";
import { Toggle } from "@/components/Toggle";
import { hasDesktopBridge, useServiceStatus } from "@/components/useServiceStatus";
import { DEFAULT_PRACTICE_GOALS, VOICE_MAX_SUGGESTIONS, VOICE_PROMPTS } from "@/config/conversation";
import { coachTurn, type TurnResult } from "@/lib/conversation";
import { newId } from "@/state/conversations";
import { reportHref } from "@/state/history";
import { useProfileStore } from "@/state/profileStore";
import type { FeedbackEvent, TranscriptSegment } from "@/types";
import { DEV_COACH_TURNS } from "../practice/devScript";
import { finishConversation, goalsFrom } from "../practice/finishSession";
import { TurnControls, TurnStatusLine } from "../practice/TurnControls";
import { useTurnTaking } from "../practice/useTurnTaking";

/**
 * 03 · Voice coaching (Stage 2: Coach). Private Field Journal.
 * A short spoken Q&A: the coach (Moss) asks, the person answers out loud
 * (Cartesia transcribes, and speaks the coach's replies), and up to three
 * small suggestions appear beside the conversation, tied to the answer they
 * are about. Focal point: the coach's current line. Suggestions are
 * secondary and dismissible; they never interrupt the turn.
 */
type Mode = "live" | "sample";

export function VoiceCoaching() {
  // Bumping the key remounts the screen, which resets it to its setup form.
  const [run, setRun] = useState(0);
  return <VoiceCoachingSession key={run} onReset={() => setRun((r) => r + 1)} />;
}

function VoiceCoachingSession({ onReset }: { onReset: () => void }) {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.communicationProfile);
  const services = useServiceStatus();
  const desktop = hasDesktopBridge();
  const goalOptions = goalsFrom(profile, DEFAULT_PRACTICE_GOALS);

  const [prompt, setPrompt] = useState<string>(VOICE_PROMPTS[0]);
  const [ownPrompt, setOwnPrompt] = useState("");
  const [goals, setGoals] = useState<string[]>(goalOptions.slice(0, 2));
  const [record, setRecord] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [suggestions, setSuggestions] = useState<FeedbackEvent[]>([]);
  const [ending, setEnding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const feedback = useRef<FeedbackEvent[]>([]);
  const sampleTurn = useRef(0);

  const voice = mode === "live" && Boolean(services?.cartesia);
  const turn = useTurnTaking({ speakerLabel: "Coach", aiRole: "coach", voice });
  const practicePrompt = prompt === "own" ? ownPrompt.trim() : prompt;
  const latestCoach = [...turn.transcript].reverse().find((s) => s.role === "coach");
  const running = mode != null && turn.status !== "ended";
  const missing = services ? (["moss", "cartesia"] as const).filter((s) => !services[s]) : [];

  async function next(transcript: TranscriptSegment[], m: Mode) {
    let res: TurnResult | null;
    if (m === "sample") {
      res = DEV_COACH_TURNS[Math.min(sampleTurn.current++, DEV_COACH_TURNS.length - 1)];
    } else {
      res = await coachTurn({ prompt: practicePrompt, profile, goals, transcript });
    }
    if (!res) {
      turn.setError("The coach couldn't reply just now. Answer again, or end and review.");
      turn.setStatus("your-turn");
      return;
    }
    const answer = [...transcript].reverse().find((s) => s.role === "you");
    if (answer && res.suggestions.length > 0) {
      const events: FeedbackEvent[] = res.suggestions.map((s) => ({ id: newId("fb"), atMs: answer.startMs, segmentId: answer.id, ...s }));
      feedback.current = [...feedback.current, ...events];
      setSuggestions((prev) => [...events, ...prev].slice(0, VOICE_MAX_SUGGESTIONS));
    }
    await turn.aiSays(res.reply);
  }

  async function begin(m: Mode) {
    setMode(m);
    const ok = await turn.start({ record: record && m === "live" });
    if (!ok) {
      setMode(null);
      return;
    }
    turn.setStatus("thinking");
    await next([], m);
  }

  async function answered(transcript: TranscriptSegment[] | null) {
    if (transcript && mode) await next(transcript, mode);
  }

  async function endAndReview() {
    setEnding(true);
    const done = await turn.end();
    if (mode === "sample") {
      navigate(reportHref("voice", "sample"));
      return;
    }
    const id = await finishConversation({
      kind: "voice",
      title: "Voice practice",
      goals,
      context: { Prompt: practicePrompt },
      profile,
      transcript: done.transcript,
      feedback: feedback.current,
      startedAt: done.startedAt,
      endedAt: done.endedAt,
      recording: done.recording,
    });
    navigate(reportHref("voice", id));
  }

  // Leaving a running session: release the microphone, drop the unsaved attempt, show the setup form again.
  async function backToSetup() {
    setConfirmLeave(false);
    await turn.end();
    onReset();
  }

  return (
    <AppShell back={running ? { onBack: () => setConfirmLeave(true), label: "Back to setup" } : undefined}>
      <ConfirmDialog
        open={confirmLeave}
        title="Go back to setup?"
        confirmLabel="Leave without saving"
        onConfirm={() => void backToSetup()}
        onCancel={() => setConfirmLeave(false)}
      >
        This stops the voice session and releases your microphone. No report is saved. To keep one, cancel and end the
        session instead.
      </ConfirmDialog>
      <PageHeader
        step="Step 2 of 4: practise out loud"
        title="Think it through, out loud."
        lede="A low-pressure voice session to find a clearer way into what you want to say. Answer, hear a reply, try again."
      />

      <div className="mt-10 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,1fr)]">
        <Sheet aria-labelledby="voice-title" className="px-6 py-7 md:px-9 md:py-9">
          {!running && !ending ? (
            <>
              <SectionTitle id="voice-title">Set up your session</SectionTitle>
              <fieldset className="mt-5">
                <legend className="text-[14px] font-medium">What would you like to practise?</legend>
                <div className="mt-2 border-t border-border">
                  {[...VOICE_PROMPTS, "own"].map((p) => (
                    <label key={p} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border py-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
                      <input type="radio" name="voice-prompt" value={p} checked={prompt === p} onChange={() => setPrompt(p)} className="h-4 w-4 accent-accent" />
                      <span className="text-[15.5px]">{p === "own" ? "Something of my own" : p}</span>
                    </label>
                  ))}
                </div>
                {prompt === "own" && (
                  <div className="mt-3">
                    <label htmlFor="own-prompt" className="sr-only">
                      Your own practice prompt
                    </label>
                    <input
                      id="own-prompt"
                      value={ownPrompt}
                      onChange={(e) => setOwnPrompt(e.target.value)}
                      placeholder="Explain why we should delay the launch by two weeks."
                      className="w-full rounded border border-border-strong bg-surface px-3 py-2.5 text-[15.5px]"
                    />
                  </div>
                )}
              </fieldset>

              <div className="mt-6">
                <CheckChips legend="Today's focus" help={profile?.traits.some((t) => t.keep) ? "From your communication profile." : "Suggested starting points. Build your profile to use your own."} options={goalOptions} value={goals} onChange={setGoals} />
              </div>

              <div className="mt-6 border-t border-border">
                <SettingRow label="Save an audio recording" helpId="voice-rec-help" help="Off by default. Kept on this device only, so you can listen back in the report.">
                  <Toggle checked={record} onChange={setRecord} label="Save an audio recording" describedBy="voice-rec-help" disabled={!services?.cartesia} />
                </SettingRow>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button onClick={() => void begin("live")} disabled={!services?.moss || !practicePrompt}>
                  Start voice session
                </Button>
                {import.meta.env.DEV && !services?.moss && (
                  <Button variant="ghost" onClick={() => void begin("sample")}>
                    Preview with a sample coach (dev only)
                  </Button>
                )}
              </div>
              <p className="mt-4 text-[13.5px] text-text-muted">
                Your microphone turns on when you start. Speech goes to Cartesia to be transcribed and the transcript goes to Moss for
                replies, only during the session.
              </p>
              {services && (
                <ServiceNotice className="mt-4" missing={[...missing]} desktop={desktop}>
                  {services.moss && !services.cartesia ? "You can still practise by typing your answers." : null}
                </ServiceNotice>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div>
                  <h2 id="voice-title" className="text-[14px] font-medium">
                    Voice session{mode === "sample" && <span className="ml-2 font-normal text-ochre">sample coach, not real feedback</span>}
                  </h2>
                  <p className="text-[14px] text-text-muted">{mode === "sample" ? VOICE_PROMPTS[0] : practicePrompt}</p>
                </div>
                <TurnStatusLine status={turn.status} />
              </div>

              <blockquote className="mt-7 min-h-[3.2em] max-w-[34ch] font-serif text-[clamp(22px,2.4vw,28px)] leading-snug">
                {latestCoach ? `“${latestCoach.text}”` : <span className="italic text-text-muted">The coach is getting ready…</span>}
              </blockquote>

              <div className="mt-7">
                {ending ? (
                  <p className="font-serif italic text-text-muted" aria-live="polite">
                    Writing your review…
                  </p>
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

              <div className="mt-9 border-t border-border pt-5">
                <h3 className="text-[14px] font-medium">Session transcript</h3>
                <LiveTranscript className="mt-3" segments={turn.transcript} label="Session transcript" maxHeight="max-h-[300px]" />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5">
                <Button variant="secondary" onClick={() => void endAndReview()} disabled={ending || turn.status === "listening"}>
                  End and review
                </Button>
                <p className="text-[13.5px] text-text-muted">{voice ? "Microphone on" : "Typing"}. End any time.</p>
              </div>
            </>
          )}
        </Sheet>

        <aside aria-labelledby="nudge-title" className="lg:pt-2">
          <SectionTitle id="nudge-title">A small nudge, not a script</SectionTitle>
          <p className="mt-1 text-[14px] text-text-muted">Suggestions follow your goals and what you just said. Use the ones that help.</p>
          <div className="mt-5 space-y-5">
            {suggestions.length > 0 ? (
              suggestions.map((s) => (
                <SuggestionNote
                  key={s.id}
                  category={s.category}
                  title={s.title}
                  explanation={s.explanation}
                  suggestion={s.suggestion}
                  sample={mode === "sample"}
                  onDismiss={() => setSuggestions((all) => all.filter((x) => x.id !== s.id))}
                />
              ))
            ) : (
              <p className="font-serif italic text-text-muted">Suggestions appear after your first answer.</p>
            )}
          </div>
          {running && goals.length > 0 && (
            <div className="mt-9 border-t border-border pt-5">
              <h3 className="text-[14px] font-medium">Today&apos;s focus</h3>
              <ul className="mt-2 space-y-1 text-[15px]">
                {goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
