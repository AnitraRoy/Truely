import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { SectionTitle } from "@/components/Sheet";
import { formatDuration, plural } from "@/components/format";
import { EvidenceReview, ReportFacts, ReportHeader, StoodOut, TakeawayPanel, evidenceNotes } from "@/components/report/ReportParts";
import { formatClock } from "@/components/videoReview/time";
import { FEEDBACK_CATEGORY_LABELS } from "@/config/conversation";
import { getConversation, getRecording, newId } from "@/state/conversations";
import { KIND_LABELS } from "@/state/history";
import { useProfileStore } from "@/state/profileStore";
import type { ConversationKind, ConversationSession, FeedbackCategory } from "@/types";
import { SAMPLE_SESSIONS } from "./samples";

/**
 * Session report boards: 07 mock interview, 08 voice coaching, 09 live
 * coaching. One layout and one data model (ConversationSession), with
 * content that fits each kind. Reflection only: observations tied to
 * transcript lines, no score, and no claim that a suggestion caused a change
 * (CLAUDE.md §5). When the reflection couldn't be written, the transcript and
 * notes still show and the page says so.
 */
type Load = { status: "loading" } | { status: "missing" } | { status: "ready"; session: ConversationSession };

const KINDS: ConversationKind[] = ["voice", "interview", "live"];
const WHEN = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function downloadNotes(session: ConversationSession) {
  const r = session.report;
  const lines = [
    `${session.title} (${KIND_LABELS[session.kind]})`,
    WHEN.format(session.startedAt),
    "",
    ...(r ? [r.summary, "", "Try next time:", ...r.nextSteps.map((n) => `- ${n}`), ""] : []),
    "Transcript:",
    ...session.transcript.map((t) => `[${formatClock(t.startMs)}] ${t.speaker ? `${t.speaker}: ` : ""}${t.text}`),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `cue-${session.kind}-${new Date(session.startedAt).toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConversationReport() {
  const { kind: rawKind, id } = useParams();
  const kind = KINDS.includes(rawKind as ConversationKind) ? (rawKind as ConversationKind) : null;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!kind || !id) {
      setLoad({ status: "missing" });
      return;
    }
    if (id === "sample" && import.meta.env.DEV) {
      setLoad({ status: "ready", session: SAMPLE_SESSIONS[kind] });
      return;
    }
    getConversation(id).then((session) => {
      if (cancelled) return;
      setLoad(session && session.kind === kind ? { status: "ready", session } : { status: "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const session = load.status === "ready" ? load.session : null;

  useEffect(() => {
    if (!session?.recording) return;
    let url: string | null = null;
    getRecording(session.recording.blobKey).then((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setRecordingUrl(url);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [session]);

  if (load.status === "loading") {
    return (
      <AppShell>
        <p className="font-serif italic text-text-muted" aria-live="polite">
          Opening this session…
        </p>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <EmptyState title="Session not found" action={<Link to="/reports" className="underline underline-offset-4 hover:text-accent">Open session history</Link>}>
          This session isn&apos;t on this device. It may have been deleted, or saving was off and the tab was closed.
        </EmptyState>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Board session={session} recordingUrl={recordingUrl} />
    </AppShell>
  );
}

function Board({ session, recordingUrl }: { session: ConversationSession; recordingUrl: string | null }) {
  const navigate = useNavigate();
  const r = session.report;
  const notes = useMemo(() => evidenceNotes(session), [session]);
  const yourTurns = session.transcript.filter((t) => t.role === "you").length;
  const durationMs = (session.endedAt ?? session.startedAt) - session.startedAt;
  const context = Object.entries(session.context ?? {});

  const facts = [
    { label: "Length", value: formatDuration(durationMs) },
    session.kind === "live" ? { label: "Transcript lines", value: session.transcript.length } : { label: "Your answers", value: yourTurns },
    { label: "Suggestions given", value: session.kind === "interview" ? "None during" : session.feedback.length },
    { label: "Recording", value: session.recording ? (session.recording.hasVideo ? "Video, on this device" : "Audio, on this device") : "Not recorded" },
  ];

  const again = { voice: "/practice/voice", interview: "/practice/interview", live: "/session" }[session.kind];

  return (
    <article>
      {session.sample && (
        <p className="mb-8 border-l-2 border-ochre-mark pl-3.5 text-[14.5px] text-text-muted">
          Development sample: fictional data for reviewing this layout. Real reports only use your own sessions.
        </p>
      )}

      <ReportHeader
        kindLabel={KIND_LABELS[session.kind].toLowerCase()}
        title={session.title}
        meta={`${WHEN.format(session.startedAt)}${context.length ? `. ${context.map(([, v]) => v).join(", ")}` : ""}`}
        actions={
          session.transcript.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => downloadNotes(session)}>
              Download notes
            </Button>
          )
        }
      />

      <p className="mt-6 max-w-[62ch] font-serif text-[clamp(19px,1.9vw,22px)] leading-snug">
        {r ? r.summary : <span className="italic text-text-muted">truely. couldn&apos;t write a reflection for this session. The transcript and any notes are below.</span>}
      </p>
      {session.goals.length > 0 && <p className="mt-3 text-[14px] text-text-muted">Your focus: {session.goals.join(", ")}.</p>}

      <div className="mt-8">
        <ReportFacts facts={facts} />
      </div>

      {session.kind === "voice" ? <VoiceBody session={session} recordingUrl={recordingUrl} /> : null}

      {session.kind !== "voice" && (
        <section aria-label="Recording and transcript" className="mt-10">
          {session.transcript.length > 0 ? (
            <EvidenceReview
              session={session}
              recordingUrl={recordingUrl}
              notes={notes}
              notesTitle={session.kind === "live" ? "Patterns noticed" : "Moments to revisit"}
            />
          ) : (
            <EmptyState title="No transcript">Nothing was transcribed in this session.</EmptyState>
          )}
        </section>
      )}

      {r && session.kind !== "voice" && (
        <div className="mt-12">
          <StoodOut strengths={r.strengths} improvements={r.improvements} />
        </div>
      )}

      {r && (
        <div className="mt-12">
          <TakeawayPanel
            keep={r.strengths[0]}
            next={r.nextSteps}
            action={
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button variant="inverse" onClick={() => navigate(again)}>
                  {session.kind === "live" ? "Set up another session" : "Practice again"}
                </Button>
                {r.nextSteps[0] && <AddToGoals text={r.nextSteps[0]} category={session.feedback[0]?.category} disabled={session.sample} />}
              </div>
            }
          />
        </div>
      )}

      <p className="mt-10 text-[13.5px] text-text-muted">
        These notes describe what was said, not who you are. There&apos;s no score, and a suggestion appearing before a change doesn&apos;t mean it
        caused it.
      </p>
    </article>
  );
}

/** 08 · Voice: before and after, in the person's own words, then the coach's notes. */
function VoiceBody({ session, recordingUrl }: { session: ConversationSession; recordingUrl: string | null }) {
  const byId = new Map(session.transcript.map((t) => [t.id, t]));
  const moments = (session.report?.moments ?? []).filter((m) => byId.has(m.segmentId));
  const feedback = session.feedback.filter((f) => f.segmentId && byId.has(f.segmentId));
  const notes = evidenceNotes(session);

  return (
    <>
      <section aria-labelledby="moments-title" className="mt-10">
        <SectionTitle id="moments-title">Selected transcript moments</SectionTitle>
        {moments.length > 0 ? (
          <ol className="mt-4 grid gap-6 md:grid-cols-2">
            {moments.map((m) => {
              const line = byId.get(m.segmentId)!;
              return (
                <li key={m.segmentId} className="border-t-2 border-text-primary pt-4">
                  <p className="flex items-baseline justify-between gap-3 text-[13.5px] text-text-muted">
                    <span className="font-medium text-text-primary">{m.label}</span>
                    <span className="font-mono text-[12px] tabular-nums">{formatClock(line.startMs)}</span>
                  </p>
                  <blockquote className="mt-3 font-serif text-[19px] leading-snug">&ldquo;{line.text}&rdquo;</blockquote>
                  <p className="mt-3 text-[14.5px] text-text-muted">{m.note}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 font-serif italic text-text-muted">No moments were selected for this session.</p>
        )}
      </section>

      {feedback.length > 0 && (
        <section aria-labelledby="coachnotes-title" className="mt-12">
          <SectionTitle id="coachnotes-title">Coach notes during the session</SectionTitle>
          <ol className="mt-3 border-t border-border">
            {feedback.map((f) => (
              <li key={f.id} className="grid grid-cols-[56px_1fr] gap-x-4 border-b border-border py-3.5">
                <span className="pt-0.5 font-mono text-[12px] tabular-nums text-text-muted">{formatClock(f.atMs)}</span>
                <span>
                  <span className="block text-[12.5px] text-text-muted">{FEEDBACK_CATEGORY_LABELS[f.category]}</span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="block text-[15px] text-text-muted">{f.explanation}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <details className="mt-10 border-t border-border pt-4" open={Boolean(recordingUrl)}>
        <summary className="min-h-6 cursor-pointer font-medium">
          {recordingUrl ? "Recording and full transcript" : `Full transcript (${plural(session.transcript.length, "line")})`}
        </summary>
        <div className="mt-5">
          <EvidenceReview session={session} recordingUrl={recordingUrl} notes={notes} notesTitle="All marked moments" />
        </div>
      </details>
    </>
  );
}

/** Carry a next step into the communication profile as the person's own pattern. */
function AddToGoals({ text, category = "clarity", disabled }: { text: string; category?: FeedbackCategory; disabled?: boolean }) {
  const profile = useProfileStore((s) => s.communicationProfile);
  const setProfile = useProfileStore((s) => s.setCommunicationProfile);
  const exists = profile?.traits.some((t) => t.description === text);
  const [added, setAdded] = useState(false);

  if (added || exists) return <p className="text-[14px] opacity-90">In your practice goals.</p>;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const base = profile ?? { admire: "", contexts: [], traits: [], updatedAt: Date.now() };
        setProfile({
          ...base,
          traits: [...base.traits, { id: newId("own"), category, name: text.split(/\s+/).slice(0, 4).join(" "), description: text, keep: true }],
          updatedAt: Date.now(),
        });
        setAdded(true);
      }}
      className="min-h-6 text-[14.5px] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Add &ldquo;{text}&rdquo; to my practice goals
    </button>
  );
}
