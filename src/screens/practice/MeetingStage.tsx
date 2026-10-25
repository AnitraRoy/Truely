import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Button } from "@/components/Button";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MicProblem } from "@/components/PermissionList";
import { SuggestionNote } from "@/components/SuggestionNote";
import type { MicState } from "@/components/useMicrophone";
import { CueBubble } from "@/components/CueBubble";
import type { PreviewState } from "@/components/useWebcamPreview";
import { formatClock } from "@/components/videoReview/time";
import { PRACTICE_CALL } from "@/config/conversation";
import type { FeedbackEvent, TranscriptSegment } from "@/types";
import { TURN_STATUS_LABEL, type TurnStatus } from "./useTurnTaking";

/**
 * The practice call room, laid out like a video call. Owner: Design System.
 *
 * Focal point: the AI's speaker tile, a large monogram bubble whose ring
 * follows the loudness of its voice (the "who is talking" cue every meeting
 * app uses). Secondary: the caption of what it just said, along the bottom,
 * and the control bar. Tertiary: the person's own camera in a small self-view
 * tile, and what Cue notices: a camera cue (from the on-device analysis the
 * screen runs, useCameraCoaching) and suggestions arrive at the top centre and
 * fade on their own; suggestions stay in Notes. A session without live
 * suggestions (mock interviews) omits them and gets a transcript panel only.
 * The camera is opened by the screen, never here; this only shows it.
 *
 * The person presses Space to start answering and Space again when done.
 * Space is ignored while typing in a field, so the typed-answer box still
 * works. The room uses the night palette in either theme (`data-surface`).
 */
type PanelTab = "notes" | "transcript";

export interface MeetingStageProps {
  title: string;
  /** What is being practised, shown in the header. */
  topic: string;
  aiName: string;
  status: TurnStatus;
  transcript: TranscriptSegment[];
  aiLevel: MutableRefObject<number>;
  /** Speech in and out is on; otherwise the person types. */
  voice: boolean;
  mic: MicState;
  error: string | null;
  /** Live suggestions. Omit for sessions that hold feedback until the report. */
  suggestions?: FeedbackEvent[];
  onDismissSuggestion?: (id: string) => void;
  /** Where the session is, e.g. "Question 2 of 6", shown in the header. */
  progress?: string;
  /** No more answers are expected (the interviewer has closed). */
  closed?: boolean;
  /** Footer line once closed. */
  closedHint?: string;
  /** Label of the end button. */
  endLabel?: string;
  /** Development sample: labelled, not real feedback. */
  sample?: boolean;
  /** The session recording is running (shown, always, while it is). */
  recording?: boolean;
  /** The recording includes the camera. */
  recordingVideo?: boolean;
  /** The camera preview, from the screen's camera session. */
  camera: { videoRef: React.RefObject<HTMLVideoElement>; state: PreviewState };
  videoOn: boolean;
  onToggleVideo: (on: boolean) => void;
  /** Tracking status text (e.g. face not visible). Never a judgment. */
  trackingMessage?: string | null;
  /** Camera analysis is unavailable until calibration. */
  needsCalibration?: boolean;
  /** The current camera cue, if any. */
  cue?: { id: string; text: string } | null;
  onDismissCue?: () => void;
  /** ms since the session began. */
  now: () => number;
  ending: boolean;
  onBegin: () => void;
  onFinish: () => void;
  onTyped: (text: string) => void;
  onEnd: () => void;
  /** Abandon the call instead of finishing it (the screen confirms first). Omit to hide the control. */
  onLeave?: () => void;
  leaveLabel?: string;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.getAttribute("data-motion") === "reduce" ||
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

/** The AI's tile: monogram bubble, a ring that follows its voice, name and state. */
function SpeakerTile({ name, status, level }: { name: string; status: TurnStatus; level: MutableRefObject<number> }) {
  const ring = useRef<HTMLDivElement>(null);
  const speaking = status === "speaking";

  useEffect(() => {
    const el = ring.current;
    if (!el) return;
    if (!speaking || prefersReducedMotion()) {
      el.style.transform = "";
      return;
    }
    let frame = 0;
    let shown = 0;
    const tick = () => {
      shown += (level.current - shown) * 0.35; // ease toward the live level so the ring breathes, not flickers
      el.style.transform = `scale(${1 + shown * 0.22})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speaking, level]);

  const state = speaking ? "Speaking" : status === "thinking" ? "Thinking" : status === "listening" ? "Listening to you" : status === "transcribing" ? "Reading your answer" : "";

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid h-[clamp(128px,20vmin,208px)] w-[clamp(128px,20vmin,208px)] place-items-center">
        <div
          ref={ring}
          aria-hidden
          className={`absolute -inset-3 rounded-pill border-[3px] transition-[border-color,opacity] duration-cue ease-cue ${
            speaking ? "border-accent opacity-100" : "border-transparent opacity-0"
          }`}
        />
        <div className="grid h-full w-full place-items-center rounded-pill bg-accent font-display text-[clamp(52px,8vmin,84px)] font-semibold leading-none text-on-accent">
          {name.charAt(0)}
        </div>
      </div>
      <p className="mt-7 font-display text-[22px] font-semibold">{name}</p>
      <p className="mt-1 min-h-[1.5em] text-[15px] text-text-muted" aria-live="polite">
        {state}
      </p>
    </div>
  );
}

/** The person's own camera, mirrored. Local only. */
function SelfView({
  cam,
  listening,
  cameraOn,
  onToggleCamera,
  note,
}: {
  cam: MeetingStageProps["camera"];
  listening: boolean;
  cameraOn: boolean;
  onToggleCamera: (on: boolean) => void;
  /** Quiet status over the preview: tracking, or analysis being off. */
  note?: string | null;
}) {
  const live = cam.state === "live";
  const message =
    !cameraOn ? "Camera off" : cam.state === "denied" ? "Camera blocked" : cam.state === "busy" ? "Camera in use by another app" : cam.state === "unavailable" ? "No camera found" : "Starting camera…";

  return (
    <figure
      className={`relative m-0 aspect-video w-[clamp(140px,22vw,288px)] overflow-hidden rounded-lg border border-border bg-sunken outline outline-2 outline-offset-2 transition-[outline-color] duration-cue ease-cue ${
        listening ? "outline-accent" : "outline-transparent"
      }`}
    >
      <video ref={cam.videoRef} muted autoPlay playsInline aria-label="Your camera" className={`h-full w-full -scale-x-100 object-cover ${live ? "" : "invisible"}`} />
      {!live && (
        <div className="absolute inset-0 grid place-items-center px-3 text-center">
          <p className="text-[13.5px] text-text-muted">{message}</p>
        </div>
      )}
      {live && note && <p className="absolute inset-x-2 top-2 rounded bg-scrim/70 px-2 py-1 text-[12.5px] leading-snug text-text-primary">{note}</p>}
      <figcaption className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-scrim/70 px-2 py-1 text-[13px] text-text-primary">
        You
        {listening && <span className="text-accent">speaking</span>}
      </figcaption>
      {!cameraOn && (
        <button
          type="button"
          onClick={() => onToggleCamera(true)}
          className="absolute right-2 top-2 min-h-6 rounded px-1.5 text-[12.5px] text-text-muted underline underline-offset-2 hover:text-text-primary"
        >
          Turn on
        </button>
      )}
    </figure>
  );
}

/** The newest suggestion, top centre. Fades after a while; always kept in Notes. */
function SuggestionToast({ suggestion, sample, onHide }: { suggestion: FeedbackEvent; sample?: boolean; onHide: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onHide, PRACTICE_CALL.suggestionVisibleMs);
    return () => window.clearTimeout(id);
  }, [suggestion.id, onHide]);

  return (
    <div className="rounded-lg border border-border-strong bg-bg/95 px-4 py-3">
      <SuggestionNote
        compact
        category={suggestion.category}
        title={suggestion.title}
        explanation={suggestion.explanation}
        sample={sample}
        onDismiss={onHide}
      />
    </div>
  );
}

export function MeetingStage(props: MeetingStageProps) {
  const { status, voice, mic, onBegin, onFinish } = props;
  const root = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [typing, setTyping] = useState(!voice);
  const [typed, setTyped] = useState("");
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const hasNotes = props.suggestions !== undefined;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const yourTurn = status === "your-turn";
  const listening = status === "listening";
  const canSpeak = voice && mic === "live" && !props.closed;

  const now = useRef(props.now);
  now.current = props.now;
  useEffect(() => {
    root.current?.focus();
    const id = window.setInterval(() => setElapsed(now.current()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Space starts an answer, and Space again finishes it.
  useEffect(() => {
    if (!canSpeak) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== PRACTICE_CALL.answerKey || isTextEntry(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // Claim the key so it doesn't also press whichever button has focus.
      e.preventDefault();
      if (e.type !== "keydown" || e.repeat) return;
      if (status === "your-turn") onBegin();
      else if (status === "listening") onFinish();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [canSpeak, status, onBegin, onFinish]);

  const caption = [...props.transcript].reverse().find((s) => s.role !== "you");
  const toast = props.suggestions?.find((s) => !hidden.has(s.id));
  const hideToast = () => toast && setHidden((h) => new Set(h).add(toast.id));

  const answerHint = !canSpeak
    ? null
    : listening
      ? `Press ${PRACTICE_CALL.answerKeyLabel} when you're done`
      : yourTurn
        ? `Press ${PRACTICE_CALL.answerKeyLabel} to answer`
        : TURN_STATUS_LABEL[status];

  function sendTyped() {
    if (!yourTurn || !typed.trim()) return;
    props.onTyped(typed);
    setTyped("");
  }

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-surface="stage"
      role="region"
      aria-label={`${props.title} call`}
      className="fixed inset-0 z-40 flex flex-col bg-sunken font-sans text-text-primary outline-none"
    >
      <header className="flex min-h-14 items-center gap-4 px-4 sm:px-6">
        <span className="font-display text-[17px] font-semibold leading-none">
          Cue<span className="text-ochre-mark">.</span>
        </span>
        {props.onLeave && (
          <button
            type="button"
            onClick={props.onLeave}
            className="min-h-8 shrink-0 text-[13px] text-text-muted underline underline-offset-2 hover:text-text-primary"
          >
            {props.leaveLabel ?? "Leave"}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14.5px] font-medium">
            {props.title}
            {props.sample && <span className="ml-2 font-normal text-ochre">sample coach, not real feedback</span>}
          </h1>
          <p className="truncate text-[13px] text-text-muted">{props.topic}</p>
        </div>
        {props.recording && (
          <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <span aria-hidden className="h-2 w-2 rounded-pill bg-ochre-mark" />
            {props.recordingVideo ? "Recording video and audio" : "Recording audio"}
          </p>
        )}
        {props.progress && <p className="hidden text-[13px] text-text-muted sm:block">{props.progress}</p>}
        <p className="font-mono text-[13px] text-text-muted" aria-label={`Elapsed ${formatClock(elapsed)}`}>
          {formatClock(elapsed)}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface">
          {(toast || props.cue) && (
            <div className="absolute left-1/2 top-[108px] z-10 w-[min(460px,calc(100%-24px))] -translate-x-1/2 space-y-2 sm:top-4" aria-live="polite">
              {props.cue && (
                <div className="rounded-lg">
                  <CueBubble key={props.cue.id} text={props.cue.text} onDismiss={props.onDismissCue} floating />
                </div>
              )}
              {toast && <SuggestionToast key={toast.id} suggestion={toast} sample={props.sample} onHide={hideToast} />}
            </div>
          )}

          <div className="grid flex-1 place-items-center px-4 pb-40 pt-24">
            <SpeakerTile name={props.aiName} status={status} level={props.aiLevel} />
          </div>

          <div className="absolute right-3 top-3 sm:bottom-3 sm:top-auto">
            <SelfView
              cam={props.camera}
              listening={listening}
              cameraOn={props.videoOn}
              onToggleCamera={props.onToggleVideo}
              note={props.trackingMessage ?? (props.needsCalibration ? "Calibrate your camera to get cues" : null)}
            />
          </div>

          <div className="absolute inset-x-3 bottom-3 flex justify-center sm:inset-x-[calc(clamp(140px,22vw,288px)+2rem)]">
            <div className="w-full max-w-[64ch]">
              {(props.error || mic === "denied" || mic === "unavailable") && (
                <div className="mb-2 rounded bg-bg/95 px-4 py-2.5">
                  {props.error && (
                    <p role="alert" className="text-[14.5px] text-warning">
                      {props.error}
                    </p>
                  )}
                  {(mic === "denied" || mic === "unavailable") && <MicProblem state={mic} />}
                </div>
              )}
              {typing && !props.closed ? (
                <form
                  className="rounded-lg bg-bg/95 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendTyped();
                  }}
                >
                  <label htmlFor="typed-answer" className="sr-only">
                    Your answer
                  </label>
                  <textarea
                    id="typed-answer"
                    value={typed}
                    autoFocus
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendTyped();
                      }
                    }}
                    rows={2}
                    placeholder={caption ? "Type your answer. Enter sends." : "Waiting for the first question…"}
                    className="w-full resize-none rounded border border-border-strong bg-surface px-3 py-2 text-[16px] leading-relaxed placeholder:text-text-muted"
                  />
                  <div className="mt-2 flex items-center justify-end gap-4">
                    {voice && (
                      <button type="button" onClick={() => setTyping(false)} className="min-h-6 text-[14px] underline underline-offset-4 hover:text-accent">
                        Speak instead
                      </button>
                    )}
                    <Button type="submit" size="sm" disabled={!yourTurn || !typed.trim()}>
                      Send answer
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="rounded bg-scrim/75 px-5 py-3 text-center" aria-live="polite">
                  {caption ? (
                    <>
                      <p className="text-[13px] text-text-muted">{caption.speaker ?? props.aiName}</p>
                      <p className="mt-0.5 font-serif text-[clamp(18px,2vw,22px)] leading-snug">{caption.text}</p>
                    </>
                  ) : (
                    <p className="font-serif text-[18px] italic text-text-muted">{props.aiName} is getting ready…</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {panel && (
          <aside aria-label={panel === "notes" ? "Notes" : "Transcript"} className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface md:flex">
            <div className="flex items-center gap-1 border-b border-border p-2">
              {(hasNotes ? (["notes", "transcript"] as const) : (["transcript"] as const)).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={panel === t}
                  onClick={() => setPanel(t)}
                  className={`min-h-9 rounded px-3 text-[14px] ${panel === t ? "bg-sunken font-medium" : "text-text-muted hover:text-text-primary"}`}
                >
                  {t === "notes" ? "Notes" : "Transcript"}
                </button>
              ))}
              <button type="button" onClick={() => setPanel(null)} aria-label="Close panel" className="ml-auto grid h-9 w-9 place-items-center rounded text-text-muted hover:bg-sunken hover:text-text-primary">
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel === "transcript" ? (
                <LiveTranscript segments={props.transcript} label="Session transcript" maxHeight="max-h-none" />
              ) : props.suggestions && props.suggestions.length > 0 ? (
                <div className="space-y-5">
                  {props.suggestions.map((s) => (
                    <SuggestionNote
                      key={s.id}
                      category={s.category}
                      title={s.title}
                      explanation={s.explanation}
                      suggestion={s.suggestion}
                      sample={props.sample}
                      onDismiss={props.onDismissSuggestion && (() => props.onDismissSuggestion?.(s.id))}
                    />
                  ))}
                </div>
              ) : (
                <p className="font-serif italic text-text-muted">Suggestions appear here after your first answer.</p>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="flex min-h-[76px] flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 pb-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <p className="hidden text-[14px] text-text-muted sm:block" aria-live="polite">
          {props.closed ? props.closedHint : (answerHint ?? (yourTurn ? "Your turn: type your answer" : TURN_STATUS_LABEL[status]))}
        </p>

        <div className="flex items-center gap-2 sm:col-start-2">
          {canSpeak && !typing && (
            <button
              type="button"
              onClick={listening ? onFinish : onBegin}
              disabled={!listening && !yourTurn}
              aria-keyshortcuts={PRACTICE_CALL.answerKey}
              className={`flex min-h-12 items-center gap-2.5 whitespace-nowrap rounded-pill px-4 sm:px-5 text-[15px] font-medium transition-colors duration-cue ease-cue disabled:opacity-50 ${
                listening ? "bg-accent text-on-accent hover:bg-accent-hover" : "bg-bg text-text-primary hover:bg-border"
              }`}
            >
              <span aria-hidden className={`h-2.5 w-2.5 rounded-pill ${listening ? "bg-on-accent" : "border-2 border-current"}`} />
              {listening ? "Done answering" : "Answer"}
              <kbd className="rounded border border-current px-1.5 py-0.5 font-sans text-[12px] opacity-80">{PRACTICE_CALL.answerKeyLabel}</kbd>
            </button>
          )}
          {voice && !props.closed && (
            <button
              type="button"
              onClick={() => setTyping((t) => !t)}
              disabled={listening}
              className="min-h-12 whitespace-nowrap rounded-pill bg-bg px-3.5 text-[14.5px] hover:bg-border disabled:opacity-50 sm:px-4"
            >
              {typing ? "Speak" : "Type"}
            </button>
          )}
          <button type="button" onClick={() => props.onToggleVideo(!props.videoOn)} className="min-h-12 whitespace-nowrap rounded-pill bg-bg px-3.5 text-[14.5px] hover:bg-border sm:px-4">
            {props.videoOn ? "Stop video" : "Start video"}
          </button>
          <button
            type="button"
            aria-pressed={panel != null}
            onClick={() => setPanel((p) => (p ? null : hasNotes ? "notes" : "transcript"))}
            className="hidden min-h-12 rounded-pill bg-bg px-4 text-[14.5px] hover:bg-border md:block"
          >
            {hasNotes ? "Notes" : "Transcript"}
            {props.suggestions && props.suggestions.length > 0 && <span className="ml-1.5 text-text-muted">{props.suggestions.length}</span>}
          </button>
        </div>

        <div className="flex justify-end sm:col-start-3">
          {props.ending ? (
            <p className="font-serif italic text-text-muted" aria-live="polite">
              Writing your review…
            </p>
          ) : (
            <Button size="sm" variant={props.closed ? "primary" : "secondary"} onClick={props.onEnd} disabled={listening}>
              {props.endLabel ?? "End and review"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
