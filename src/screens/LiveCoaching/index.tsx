import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/state/sessionStore";
import { useProfileStore } from "@/state/profileStore";
import { Button } from "@/components/Button";
import { FloatingOverlay } from "@/components/FloatingOverlay";
import { StatusChip } from "@/components/StatusChip";
import { BackButton } from "@/components/BackButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFloatingOverlay } from "@/components/useFloatingOverlay";
import { CueBubble } from "@/components/CueBubble";
import { LiveTranscript } from "@/components/LiveTranscript";
import { SuggestionNote } from "@/components/SuggestionNote";
import { MicProblem } from "@/components/PermissionList";
import { useServiceStatus } from "@/components/useServiceStatus";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { WebcamFrame } from "@/components/WebcamFrame";
import { DEFAULT_PRACTICE_GOALS } from "@/config/conversation";
import { reportHref } from "@/state/history";
import { SessionOverlay } from "./SessionOverlay";
import { useSampleCues } from "./useSampleCues";
import { useLiveConversation } from "./useLiveConversation";
import { Preflight, type LiveChoices } from "./Preflight";
import { finishConversation, goalsFrom } from "../practice/finishSession";

/**
 * 05 · Live coaching (PRD §6 Screen C) — the most important screen.
 * Private Field Journal. Starts with a preflight where the person chooses
 * exactly what Cue may access (microphone, camera signals, recording); nothing
 * is requested until they start.
 *
 * CLAUDE.md §6: with the camera on, the preview is the focal point; cues and
 * suggestions are discreet margin notes that fade on their own; status stays
 * secondary. With the camera off, the transcript takes the focal position.
 * Behavioral cues are labelled samples until the coaching engine is wired in
 * (useSampleCues); conversation suggestions come from Moss and cite a line.
 *
 * "Float cues over" moves cues into a small always-on-top window
 * (<SessionOverlay>), kept out of screen shares in the desktop shell.
 */
/** The overlay holds one cue: wide enough for two lines of cue copy. */
const OVERLAY_SIZE = { width: 380, height: 150 };

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveCoaching() {
  const [choices, setChoices] = useState<LiveChoices | null>(null);
  return choices ? <LiveSession choices={choices} onBack={() => setChoices(null)} /> : <Preflight onStart={setChoices} />;
}

function LiveSession({ choices, onBack }: { choices: LiveChoices; onBack: () => void }) {
  const navigate = useNavigate();
  const status = useSessionStore((s) => s.status);
  const setStatus = useSessionStore((s) => s.setStatus);
  const profile = useProfileStore((s) => s.communicationProfile);
  const services = useServiceStatus();
  const goals = useMemo(() => goalsFrom(profile, DEFAULT_PRACTICE_GOALS), [profile]);
  const { videoRef, state, enable, disable } = useWebcamPreview();
  const overlay = useFloatingOverlay({ title: "Cue", ...OVERLAY_SIZE });
  const desktop = overlay.desktop;
  const floating = overlay.overlayWindow != null;

  const camera = choices.camera;
  const live = camera ? state === "live" : true;
  const paused = status === "paused";
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const startRef = useRef<number | null>(null);
  // While floating, this tab is usually hidden and its timers get throttled;
  // the overlay window stays visible, so timers run on its clock instead.
  const clock = overlay.overlayWindow ?? window;
  const samples = useSampleCues({ active: camera && live && !paused, clock });
  const convo = useLiveConversation({ enabled: choices.microphone, paused, suggest: Boolean(services?.moss), profile, goals });

  // The person chose these in the preflight; the browser asks for permission now.
  useEffect(() => {
    if (camera) void enable();
    void convo.start({ record: choices.record });
    // Run once on mount: the choices are fixed for the session.
  }, []);

  useEffect(() => {
    if (live && startRef.current == null) {
      startRef.current = Date.now();
      setStatus("observing");
    }
  }, [live, setStatus]);

  useEffect(() => {
    if (!live) return;
    const id = clock.setInterval(() => {
      if (startRef.current != null && !paused) setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => clock.clearInterval(id);
  }, [live, paused, clock]);

  const togglePause = () => setStatus(paused ? "observing" : "paused");

  // One cue at a time: a conversation suggestion wins over a behavioral sample.
  const overlayCue = convo.suggestion ? { id: convo.suggestion.id, text: convo.suggestion.title } : samples.cue;
  const dismissOverlay = convo.suggestion ? convo.dismissSuggestion : samples.dismiss;

  // Back out to the choices without saving a report. The camera, microphone and
  // floating window are all released first, same as ending the session.
  async function leave() {
    setEnding(true);
    setConfirmLeave(false);
    overlay.close();
    disable();
    await convo.stop();
    setStatus("ready");
    onBack();
  }

  async function end() {
    setEnding(true);
    overlay.close();
    disable();
    const done = await convo.stop();
    setStatus("ended");
    if (!choices.microphone || done.transcript.length === 0) {
      navigate("/report/local");
      return;
    }
    const id = await finishConversation({
      kind: "live",
      title: choices.title || "Live conversation",
      goals,
      profile,
      transcript: done.transcript,
      feedback: done.feedback,
      startedAt: done.startedAt,
      endedAt: done.endedAt,
      recording: done.recording,
    });
    navigate(reportHref("live", id));
  }

  const transcriptBlock = choices.microphone && (
    <LiveTranscript
      segments={convo.transcript}
      pending={paused ? "Paused: not listening." : convo.transcribing ? "Transcribing…" : undefined}
      emptyText="Listening. Lines appear here every few seconds."
      label="Live transcript"
      maxHeight={camera ? "max-h-[220px]" : "max-h-[460px]"}
    />
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <span className="flex items-center gap-4 font-display text-[20px] font-semibold">
          <BackButton fallback="/home" label="Back to choices" onBack={() => setConfirmLeave(true)} />
          <span>
          Cue<span className="text-ochre-mark">.</span>
          {choices.title && <span className="ml-3 font-sans text-[14.5px] font-normal text-text-muted">{choices.title}</span>}
          </span>
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12.5px] tabular-nums text-text-muted" aria-label={`Elapsed ${fmt(elapsed)}`}>
            {fmt(elapsed)}
          </span>
          <StatusChip status={live ? status : "ready"} />
        </div>
      </header>

      <div className="mt-6 grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_280px]">
        {/* focal point: the preview when the camera is on, otherwise the transcript */}
        <div>
          {camera ? (
            <WebcamFrame videoRef={videoRef} state={state} />
          ) : (
            <section aria-label="Live transcript" className="rounded-lg border border-border bg-surface px-6 py-6">
              {transcriptBlock}
            </section>
          )}
          {camera && choices.microphone && (
            <details className="mt-4 border-t border-border pt-3">
              <summary className="min-h-6 cursor-pointer text-[14px] text-text-muted">Live transcript</summary>
              <div className="mt-3">{transcriptBlock}</div>
            </details>
          )}
        </div>

        {/* secondary: quiet field notes in the margin */}
        <aside className="border-l border-border pl-5">
          <h2 className="text-[13.5px] font-medium text-text-muted">Field notes</h2>
          <p className="mt-2 font-serif text-[15px] italic leading-snug">
            {paused ? "Coaching is paused. Nothing is being listened to or measured." : "Cue stays quiet unless something is worth a small note."}
          </p>

          <ul className="mt-5 space-y-2 text-[13px] text-text-muted">
            <li className="flex items-center gap-2">
              <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${choices.microphone && convo.micState === "live" && !paused ? "bg-positive" : "border border-text-muted"}`} />
              {choices.microphone ? (convo.micState === "live" ? (paused ? "Microphone paused" : "Microphone on, transcribing") : "Microphone starting") : "Microphone off"}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${camera && state === "live" ? "bg-positive" : "border border-text-muted"}`} />
              {camera ? (state === "live" ? "Camera on, frames stay on this device" : "Camera starting") : "Camera off"}
            </li>
            {choices.record && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-[7px] w-[7px] rounded-pill bg-ochre-mark" />
                Recording audio on this device
              </li>
            )}
          </ul>
          {convo.problem && <p className="mt-3 text-[13.5px] text-warning">{convo.problem}</p>}
          {(convo.micState === "denied" || convo.micState === "unavailable") && (
            <div className="mt-3">
              <MicProblem state={convo.micState} />
            </div>
          )}

          {/* the cue, as a margin note; it moves to the overlay while floating */}
          {!floating && (convo.suggestion || samples.cue) && (
            <div className="mt-6" role="status" aria-live="polite">
              {convo.suggestion ? (
                <SuggestionNote
                  key={convo.suggestion.id}
                  compact
                  category={convo.suggestion.category}
                  title={convo.suggestion.title}
                  explanation={convo.suggestion.explanation}
                  onDismiss={convo.dismissSuggestion}
                />
              ) : (
                samples.cue && <CueBubble key={samples.cue.id} text={samples.cue.text} label="sample" onDismiss={samples.dismiss} />
              )}
            </div>
          )}

          {floating && (
            <div className="mt-5 space-y-2 font-serif text-[14px] italic leading-snug text-text-muted">
              <p className="m-0">
                {desktop
                  ? `Cues are floating above your other windows${desktop.contentProtected ? ", hidden from most screen shares and recordings" : ""}.`
                  : "Cues are floating above your other tabs."}
              </p>
              {desktop && (
                <p className="m-0">
                  {desktop.hidden
                    ? `The overlay is hidden. ${desktop.shortcuts.toggleHidden} shows it.`
                    : desktop.clickThrough
                      ? `Clicks pass through the overlay. ${desktop.shortcuts.toggleClickThrough} turns this off.`
                      : `${desktop.shortcuts.toggleHidden} hides it, ${desktop.shortcuts.toggleClickThrough} lets clicks pass through.`}
                </p>
              )}
            </div>
          )}

          <div className="mt-7 flex flex-col items-start gap-3 border-t border-border pt-5">
            {overlay.supported ? (
              floating ? (
                <Button variant="ghost" onClick={overlay.close}>
                  Show cues here instead
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => void overlay.open()} disabled={!live}>
                  {overlay.mode === "desktop" ? "Float cues over other windows" : "Float cues over other tabs"}
                </Button>
              )
            ) : (
              <p className="m-0 font-serif text-[14px] italic text-text-muted">
                To float cues over your other tabs, use Chrome, Edge, or the Cue desktop app.
              </p>
            )}
            <Button variant="ghost" onClick={togglePause} disabled={!live || ending}>
              {paused ? "Resume coaching" : "Pause coaching"}
            </Button>
            <Button onClick={() => void end()} disabled={ending} className="mt-2 w-full justify-center text-center">
              {ending ? "Writing your summary…" : "End session"}
            </Button>
            <p className="text-[13px] text-text-muted">Afterwards: a summary{choices.microphone ? ", the transcript" : ""} and the moments worth revisiting.</p>
          </div>
        </aside>
      </div>

      {overlay.overlayWindow && (
        <FloatingOverlay target={overlay.overlayWindow}>
          <SessionOverlay
            cue={overlayCue}
            paused={paused}
            onDismiss={dismissOverlay}
            sample={!convo.suggestion}
            draggable={overlay.mode === "desktop"}
            onDock={overlay.mode === "desktop" ? overlay.close : undefined}
          />
        </FloatingOverlay>
      )}
    <ConfirmDialog
        open={confirmLeave}
        title="Go back to your choices?"
        confirmLabel="Leave without saving"
        onConfirm={() => void leave()}
        onCancel={() => setConfirmLeave(false)}
      >
        This stops the session and releases your camera and microphone. No report is saved. To keep a report, cancel
        and use End session instead.
      </ConfirmDialog>
    </main>
  );
}
