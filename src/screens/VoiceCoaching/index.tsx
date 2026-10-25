import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { CheckChips } from "@/components/Field";
import { SettingRow } from "@/components/SettingRow";
import { ServiceNotice } from "@/components/ServiceNotice";
import { SectionTitle, Sheet } from "@/components/Sheet";
import { Toggle } from "@/components/Toggle";
import { hasDesktopBridge, useServiceStatus } from "@/components/useServiceStatus";
import { DEFAULT_PRACTICE_GOALS, PRACTICE_CALL, VOICE_MAX_SUGGESTIONS, VOICE_PROMPTS } from "@/config/conversation";
import { coachTurn, type TurnResult } from "@/lib/conversation";
import { newId } from "@/state/conversations";
import { reportHref } from "@/state/history";
import { useProfileStore } from "@/state/profileStore";
import type { FeedbackEvent, TranscriptSegment } from "@/types";
import { DEV_COACH_TURNS } from "../practice/devScript";
import { finishConversation, goalsFrom } from "../practice/finishSession";
import { MeetingStage } from "../practice/MeetingStage";
import { useTurnTaking } from "../practice/useTurnTaking";
import { usePracticeCamera } from "../practice/useCameraCoaching";

/**
 * 03 · Voice coaching (Stage 2: Coach). Private Field Journal.
 * A short spoken Q&A: the coach (Moss) asks, the person answers out loud
 * (Cartesia transcribes, and speaks the coach's replies), and up to three
 * small suggestions appear tied to the answer they are about. Once started,
 * the session runs in a call room (MeetingStage): the coach's speaker tile is
 * the focal point, its line is captioned along the bottom, the person's camera
 * sits in a self-view corner, and Space starts and stops an answer.
 * Suggestions arrive at the top centre and never interrupt the turn.
 */
type Mode = "live" | "sample";

export function VoiceCoaching() {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.communicationProfile);
  const services = useServiceStatus();
  const desktop = hasDesktopBridge();
  const goalOptions = goalsFrom(profile, DEFAULT_PRACTICE_GOALS);

  const [prompt, setPrompt] = useState<string>(VOICE_PROMPTS[0]);
  const [ownPrompt, setOwnPrompt] = useState("");
  const [goals, setGoals] = useState<string[]>(goalOptions.slice(0, 2));
  const [record, setRecord] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [suggestions, setSuggestions] = useState<FeedbackEvent[]>([]);
  const [ending, setEnding] = useState(false);
  const feedback = useRef<FeedbackEvent[]>([]);
  const sampleTurn = useRef(0);

  const voice = mode === "live" && Boolean(services?.cartesia);
  const turn = useTurnTaking({ speakerLabel: "Coach", aiRole: "coach", voice });
  const camera = usePracticeCamera();
  const practicePrompt = prompt === "own" ? ownPrompt.trim() : prompt;
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
    // Camera first, so the recording can include it.
    const video = await camera.open();
    const ok = await turn.start({ record, voice: m === "live" && Boolean(services?.cartesia), video });
    if (!ok) {
      await camera.close(Date.now());
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
    const cam = await camera.close(done.startedAt);
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
      behavioralSessionId: cam.sessionId,
      cameraObservations: cam.observations,
    });
    navigate(reportHref("voice", id));
  }

  if (running || ending) {
    return (
      <MeetingStage
        title="Voice practice"
        topic={mode === "sample" ? VOICE_PROMPTS[0] : practicePrompt}
        aiName="Coach"
        status={turn.status}
        transcript={turn.transcript}
        aiLevel={turn.aiLevel}
        voice={voice}
        mic={turn.mic}
        error={turn.error}
        suggestions={suggestions}
        onDismissSuggestion={(id) => setSuggestions((all) => all.filter((x) => x.id !== id))}
        sample={mode === "sample"}
        {...camera.stageProps(turn.recording)}
        now={turn.now}
        ending={ending}
        onBegin={turn.beginAnswer}
        onFinish={() => void turn.finishAnswer().then(answered)}
        onTyped={(t) => void answered(turn.typedAnswer(t))}
        onEnd={() => void endAndReview()}
      />
    );
  }

  return (
    <AppShell>
      <PageHeader
        step="Step 2 of 4: practise out loud"
        title="Think it through, out loud."
        lede="A low-pressure voice session to find a clearer way into what you want to say. Answer, hear a reply, try again."
      />

      <div className="mt-10 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,1fr)]">
        <Sheet aria-labelledby="voice-title" className="px-6 py-7 md:px-9 md:py-9">
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
            <SettingRow label="Record video and audio" helpId="voice-rec-help" help="On by default. Kept on this device only, so you can play it back in the report. Turn off to skip it this time.">
              <Toggle checked={record} onChange={setRecord} label="Record video and audio" describedBy="voice-rec-help" />
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
        </Sheet>

        <aside aria-labelledby="how-title" className="lg:pt-2">
          <SectionTitle id="how-title">How the session runs</SectionTitle>
          <ul className="mt-4 space-y-4 text-[15px]">
            <li>The coach asks out loud, and its words appear as captions along the bottom.</li>
            <li>
              Press <kbd className="rounded border border-border-strong px-1.5 py-0.5 text-[13px]">{PRACTICE_CALL.answerKeyLabel}</kbd> to start
              answering and again when you&apos;re done. You can type instead at any point.
            </li>
            <li>
              Your camera shows in a small corner tile. Once you&apos;ve calibrated, Cue watches head and gaze on this device and adds a
              short cue at the top when something shifts for a while. The recording is kept on this device for the report.
            </li>
            <li>A suggestion appears at the top of the call after an answer, fades on its own, and stays in Notes.</li>
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
