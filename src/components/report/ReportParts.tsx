import { useMemo, useState, type ReactNode } from "react";
import { FEEDBACK_CATEGORY_LABELS } from "@/config/conversation";
import { SIGNAL_LABELS } from "@/lib/reports";
import type { ConversationSession, FeedbackEvent, ReportMoment, TranscriptSegment } from "@/types";
import { SectionTitle, Sheet } from "../Sheet";
import { TranscriptPanel } from "../videoReview/TranscriptPanel";
import { VideoReviewSection } from "../videoReview/VideoReviewSection";
import type { ReviewMarker } from "../videoReview/types";
import { formatClock } from "../videoReview/time";
import { MomentTimeline, type TimelineMoment } from "./MomentTimeline";

/**
 * Shared report architecture for the three session report boards (mock
 * interview, voice coaching, live coaching). Owner: Design System team.
 * Every moment, note and marker points at a transcript line by id and is
 * placed by the same ms-from-start clock, so the timeline, transcript and
 * recording can never disagree.
 */

/** Header: what kind of report, the session's name, and when. */
export function ReportHeader({ kindLabel, title, meta, actions }: { kindLabel: string; title: string; meta: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <p className="text-[13.5px] text-text-muted">Session report: {kindLabel}</p>
        <h1 className="mt-2 text-balance font-display text-[clamp(30px,3.8vw,44px)] font-semibold leading-[1.05] tracking-[-0.018em]">{title}</h1>
        <p className="mt-2 text-[15px] text-text-muted">{meta}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-4">{actions}</div>}
    </header>
  );
}

/** Counts only. "Not recorded" is a state, distinct from zero. */
export function ReportFacts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
      {facts.map((f, i) => (
        <div key={f.label} className={`py-4 ${i > 0 ? "sm:border-l sm:border-border sm:pl-5" : ""} ${i % 2 === 1 ? "border-l border-border pl-5 sm:pl-5" : ""}`}>
          <dt className="text-[13px] text-text-muted">{f.label}</dt>
          <dd className="mt-1 font-display text-[22px] leading-tight tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One timestamped note per moment, suggestion and camera cue, merged in time order. */
export interface EvidenceNote {
  id: string;
  /** A moment the report calls out, a suggestion given during the session, or a camera cue. */
  source: "moment" | "feedback" | "camera";
  atMs: number;
  segmentId: string;
  label: string;
  note: string;
  suggestion?: string;
}

export function evidenceNotes(session: ConversationSession): EvidenceNote[] {
  const byId = new Map(session.transcript.map((t) => [t.id, t]));
  const fromMoments = (session.report?.moments ?? []).map((m: ReportMoment, i) => ({
    id: `moment-${i}`,
    source: "moment" as const,
    atMs: byId.get(m.segmentId)?.startMs ?? 0,
    segmentId: m.segmentId,
    label: m.label,
    note: m.note,
  }));
  const fromFeedback = session.feedback
    .filter((f: FeedbackEvent) => f.segmentId && byId.has(f.segmentId))
    .map((f) => ({
      id: f.id,
      source: "feedback" as const,
      atMs: f.atMs,
      segmentId: f.segmentId!,
      label: `${FEEDBACK_CATEGORY_LABELS[f.category]}: ${f.title}`,
      note: f.explanation,
      suggestion: f.suggestion,
    }));
  // Camera cues point at whatever was being said when they appeared, if anything.
  const lineAt = (atMs: number) => [...session.transcript].reverse().find((t) => t.startMs <= atMs)?.id ?? "";
  const fromCamera = (session.cameraObservations ?? []).map((o) => {
    const signal = SIGNAL_LABELS[o.signal];
    return {
      id: `camera-${o.id}`,
      source: "camera" as const,
      atMs: o.atMs,
      segmentId: lineAt(o.atMs),
      label: `Camera: ${signal.charAt(0).toUpperCase()}${signal.slice(1)}`,
      note: o.text,
    };
  });
  return [...fromMoments, ...fromFeedback, ...fromCamera].sort((a, b) => a.atMs - b.atMs);
}

/**
 * The evidence block: the recording (when there is one) or the moment
 * timeline, beside the transcript, plus the notes. Selecting anything selects
 * the same transcript line everywhere.
 */
export function EvidenceReview({
  session,
  recordingUrl,
  notes,
  notesTitle,
}: {
  session: ConversationSession;
  recordingUrl: string | null;
  notes: EvidenceNote[];
  notesTitle: string;
}) {
  const durationMs = Math.max(
    session.recording?.durationMs ?? 0,
    (session.endedAt ?? session.startedAt) - session.startedAt,
    session.transcript[session.transcript.length - 1]?.endMs ?? 0,
  );

  if (recordingUrl) {
    const markers: ReviewMarker[] = notes.map((n) => ({
      id: n.id,
      kind: n.source === "feedback" ? "cue" : n.source === "camera" ? "observation" : "highlight",
      atMs: n.atMs,
      label: n.label,
      transcriptSegmentId: n.segmentId || undefined,
    }));
    return (
      <div>
        <VideoReviewSection data={{ videoSrc: recordingUrl, audioOnly: !session.recording?.hasVideo, durationMs, markers, transcript: session.transcript }} />
        <NotesList title={notesTitle} notes={notes} />
      </div>
    );
  }
  return <TranscriptOnlyReview transcript={session.transcript} durationMs={durationMs} notes={notes} notesTitle={notesTitle} />;
}

function TranscriptOnlyReview({
  transcript,
  durationMs,
  notes,
  notesTitle,
}: {
  transcript: TranscriptSegment[];
  durationMs: number;
  notes: EvidenceNote[];
  notesTitle: string;
}) {
  const [noteId, setNoteId] = useState<string | null>(notes[0]?.id ?? null);
  const [segmentId, setSegmentId] = useState<string | null>(notes[0]?.segmentId ?? null);
  const [following, setFollowing] = useState(true);
  const moments: TimelineMoment[] = useMemo(() => notes.map((n) => ({ id: n.id, atMs: n.atMs, label: n.label })), [notes]);

  const selectNote = (id: string) => {
    setNoteId(id);
    setSegmentId(notes.find((n) => n.id === id)?.segmentId ?? null);
    setFollowing(true);
  };
  // Choosing a transcript line selects the first note about it, if any.
  const selectSegment = (id: string) => {
    setSegmentId(id);
    setNoteId(notes.find((n) => n.segmentId === id)?.id ?? null);
  };

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      <Sheet aria-labelledby="timeline-title" className="px-5 py-6 md:px-7">
        <SectionTitle id="timeline-title">Conversation timeline</SectionTitle>
        <p className="mt-1 text-[14px] text-text-muted">No recording for this session. Select a moment to find it in the transcript.</p>
        {moments.length > 0 ? (
          <>
            <div className="mt-6">
              <MomentTimeline durationMs={durationMs} moments={moments} selectedId={noteId} onSelect={(m) => selectNote(m.id)} />
            </div>
            <NotesList inset title={notesTitle} notes={notes} onSelect={(n) => selectNote(n.id)} selectedId={noteId} />
          </>
        ) : (
          <p className="mt-6 font-serif italic text-text-muted">No moments were marked in this session.</p>
        )}
      </Sheet>
      <TranscriptPanel
        segments={transcript}
        activeSegmentId={segmentId}
        following={following}
        onSelectSegment={selectSegment}
        onResumeFollowing={() => setFollowing(true)}
        onPauseFollowing={() => setFollowing(false)}
        className="rounded-lg"
      />
    </div>
  );
}

function NotesList({
  title,
  notes,
  onSelect,
  selectedId,
  inset = false,
}: {
  title: string;
  notes: EvidenceNote[];
  onSelect?: (n: EvidenceNote) => void;
  selectedId?: string | null;
  /** Inside the timeline sheet (a sub-list), rather than its own page section. */
  inset?: boolean;
}) {
  if (notes.length === 0) return null;
  const Heading = inset ? "h3" : "h2";
  return (
    <section aria-labelledby={`notes-title-${inset ? "inset" : "page"}`} className={inset ? "mt-7" : "mt-10"}>
      <Heading id={`notes-title-${inset ? "inset" : "page"}`} className={inset ? "text-[14px] font-medium" : "font-display text-[21px] font-semibold leading-snug"}>
        {title}
      </Heading>
      <ol className="mt-3 border-t border-border">
        {notes.map((n) => {
          const selected = n.id === selectedId;
          const body = (
            <>
              <span className="pt-0.5 font-mono text-[12px] tabular-nums text-text-muted">{formatClock(n.atMs)}</span>
              <span>
                <span className="block font-medium">{n.label}</span>
                <span className="block text-[15px] text-text-muted">{n.note}</span>
                {n.suggestion && <span className="mt-1 block font-serif italic">Try: &ldquo;{n.suggestion.replace(/^["“]|["”]$/g, "")}&rdquo;</span>}
              </span>
            </>
          );
          const cls = `grid w-full grid-cols-[52px_1fr] gap-x-4 border-b border-border py-3.5 text-left ${inset ? "px-2" : ""}`;
          return (
            <li key={n.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(n)}
                  aria-current={selected ? "true" : undefined}
                  className={`${cls} border-l-2 transition-colors duration-cue-fast ease-cue ${
                    selected ? "border-l-ochre-mark bg-bg/70" : "border-l-transparent hover:bg-bg/50"
                  }`}
                >
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The report's one expressive moment: what to carry forward. */
export function TakeawayPanel({ keep, next, action }: { keep?: string; next: string[]; action?: ReactNode }) {
  if (!keep && next.length === 0) return null;
  return (
    <Sheet tone="accent" aria-labelledby="takeaway-title" className="grid gap-x-10 gap-y-6 px-7 py-8 md:grid-cols-2 md:px-10">
      {keep && (
        <div>
          <h2 id="takeaway-title" className="text-[13.5px] opacity-85">
            One thing to keep
          </h2>
          <p className="mt-2 font-display text-[clamp(21px,2.2vw,26px)] font-semibold leading-snug">{keep}</p>
        </div>
      )}
      <div>
        <h2 id={keep ? undefined : "takeaway-title"} className="text-[13.5px] opacity-85">
          Try next time
        </h2>
        <ul className="mt-2 space-y-2 text-[16px]">
          {next.map((n) => (
            <li key={n} className="flex gap-2.5">
              <span aria-hidden>·</span>
              {n}
            </li>
          ))}
        </ul>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </Sheet>
  );
}

/** Strengths and improvements, side by side, as plain lists. */
export function StoodOut({ strengths, improvements }: { strengths: string[]; improvements: string[] }) {
  if (strengths.length === 0 && improvements.length === 0) return null;
  return (
    <section aria-labelledby="stood-title">
      <SectionTitle id="stood-title">What stood out</SectionTitle>
      <div className="mt-3 grid gap-x-10 border-t border-border md:grid-cols-2">
        {[
          ["Worked well", strengths],
          ["Room to grow", improvements],
        ].map(([label, items]) => (
          <div key={label as string} className="py-4">
            <h3 className="text-[13.5px] text-text-muted">{label as string}</h3>
            {(items as string[]).length > 0 ? (
              <ul className="mt-2 space-y-2">
                {(items as string[]).map((s) => (
                  <li key={s} className="border-l-2 border-border pl-3 text-[15.5px]">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-serif italic text-text-muted">Nothing noted.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
