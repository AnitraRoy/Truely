import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Masthead } from "@/components/Masthead";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { StatusChip } from "@/components/StatusChip";
import { PrivacyNote } from "@/components/PrivacyNote";
import { Timeline } from "@/components/Timeline";
import { VideoReviewSection } from "@/components/videoReview/VideoReviewSection";
import { DEV_VIDEO_REVIEW_FIXTURE } from "@/components/videoReview/fixtures";
import { getStorage } from "@/state/savedData";
import {
  buildSummary,
  buildTimeline,
  buildInsights,
  buildEventDetail,
  compareSessions,
  type EventDetail,
  type TimelineItem,
} from "@/lib/reports";
import { GOAL_LABELS } from "@/config/coaching";
import { formatDate, formatTime } from "@/components/format";
import type { Session } from "@/types";
import { SessionMetrics } from "./SessionMetrics";
import { KeyObservations } from "./KeyObservations";
import { ProgressNote } from "./ProgressNote";
import { DEV_SESSION_FIXTURE, DEV_PREVIOUS_SESSION_FIXTURE } from "./devSessionFixture";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; session: Session; previousSameGoal: Session | null; isFixture: boolean };

/**
 * Screen D: Post-Session Report (PRD §6 Screen D). Field Journal.
 * Observations only — no overall score, no claimed causation (PRD §6, §12).
 */
export function PostSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showVideoFixture, setShowVideoFixture] = useState(import.meta.env.DEV);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    // No saved session to show yet is the common case this early in frontend
    // work. Rather than an error screen that leaves the layout unreviewable,
    // dev builds fall back to a clearly-labeled sample report (never in
    // production — see `devSessionFixture.ts`).
    const useDevFixture = () =>
      setState({
        status: "ready",
        session: { ...DEV_SESSION_FIXTURE, id: sessionId ?? DEV_SESSION_FIXTURE.id },
        previousSameGoal: DEV_PREVIOUS_SESSION_FIXTURE,
        isFixture: true,
      });

    if (!sessionId) {
      if (import.meta.env.DEV) useDevFixture();
      else setState({ status: "not-found" });
      return;
    }
    const storage = getStorage();
    Promise.all([storage.getSession(sessionId), storage.listSessions()])
      .then(([session, all]) => {
        if (cancelled) return;
        if (!session) {
          if (import.meta.env.DEV) useDevFixture();
          else setState({ status: "not-found" });
          return;
        }
        const previousSameGoal =
          all
            .filter((s) => s.id !== session.id && s.goal === session.goal && s.startedAt < session.startedAt)
            .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
        setState({ status: "ready", session, previousSameGoal, isFixture: false });
      })
      .catch(() => {
        if (cancelled) return;
        if (import.meta.env.DEV) useDevFixture();
        else setState({ status: "not-found" });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const session = state.status === "ready" ? state.session : null;
  const summary = useMemo(() => (session ? buildSummary(session) : null), [session]);
  const timeline = useMemo(() => (session ? buildTimeline(session) : null), [session]);
  const insights = useMemo(() => (session ? buildInsights(session) : []), [session]);
  const comparison = useMemo(
    () => (session && state.status === "ready" && state.previousSameGoal ? compareSessions(state.previousSameGoal, session) : null),
    [session, state],
  );

  const eventDetails: EventDetail[] = useMemo(() => {
    if (!session) return [];
    const withResponse = session.events.filter((e) => e.response && e.response.observedChange !== "insufficient_data");
    const chosen = (withResponse.length > 0 ? withResponse : session.events).slice(0, 2);
    return chosen
      .map((e) => buildEventDetail(session, e.id))
      .filter((d): d is EventDetail => d !== null);
  }, [session]);

  const jumpToEvent = (eventId: string) => {
    setSelectedItemId(`cue-${eventId}`);
    timelineRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const onSelectTimelineItem = (item: TimelineItem) => setSelectedItemId((id) => (id === item.id ? null : item.id));

  if (state.status === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Masthead homeHref="/" folio={<>ENTRY — session report</>} />
        <p className="mt-10 font-serif italic text-text-muted" aria-live="polite">
          Opening this session…
        </p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Masthead homeHref="/" folio={<>ENTRY — session report</>} />
        <h1 className="mt-7 font-display text-[clamp(28px,4.4vw,40px)] font-semibold leading-tight">Session not found</h1>
        <p className="mt-2 max-w-[54ch] font-serif text-text-muted">
          This report isn&apos;t on this device — it may have been deleted, or saving was off when it ran.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Button onClick={() => navigate("/calibrate")}>Start a session</Button>
          <Button variant="ghost" onClick={() => navigate("/reports")}>
            View previous sessions
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Masthead
        homeHref="/"
        folio={
          <>
            ENTRY — session report
            <br />
            self observation
          </>
        }
      />

      {state.isFixture && (
        <p className="mt-6 border-l-2 border-ochre pl-3.5 font-serif italic text-text-muted">
          Development preview — no saved session matched this link, so this report shows clearly-fictional sample data
          instead of an error screen. This only happens in local development.
        </p>
      )}

      <section className="mt-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="font-display text-[clamp(28px,4.4vw,40px)] font-semibold leading-tight">
            {GOAL_LABELS[session!.goal]}
          </h1>
          <p className="mt-2 font-serif text-text-muted">
            {formatDate(session!.startedAt)} at {formatTime(session!.startedAt)}
          </p>
        </div>
        <StatusChip status={session!.status} />
      </section>

      <h2 className="mt-10 font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Video &amp; transcript</h2>
      <div className="mt-3">
        {showVideoFixture ? (
          <>
            <p className="mb-4 border-l-2 border-ochre pl-3.5 font-serif italic text-text-muted">
              Development fixture — sample video and transcript shown for interface review only. Cue doesn&apos;t record
              video or audio during sessions, so this isn&apos;t footage of this session.{" "}
              <button type="button" onClick={() => setShowVideoFixture(false)} className="not-italic underline underline-offset-4">
                Hide preview
              </button>
            </p>
            <VideoReviewSection data={DEV_VIDEO_REVIEW_FIXTURE} />
          </>
        ) : (
          <EmptyState
            title="Video isn't recorded"
            action={
              import.meta.env.DEV ? (
                <Button variant="ghost" onClick={() => setShowVideoFixture(true)}>
                  Preview the design with sample data (dev only)
                </Button>
              ) : undefined
            }
          >
            Cue doesn&apos;t record video or audio while coaching, so there&apos;s nothing to play back here. This report
            is built entirely from on-device measurements, below.
          </EmptyState>
        )}
      </div>

      <h2 className="mt-10 font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Session</h2>
      <div className="mt-3">
        <SessionMetrics summary={summary!} />
      </div>

      <div ref={timelineRef} className="mt-9">
        <h2 className="font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Behavioral timeline</h2>
        <p className="mt-1 mb-4 font-serif text-[14px] text-text-muted">
          Measured from this session&apos;s on-device tracking — independent of the sample recording above.
        </p>
        <Timeline durationMs={timeline!.durationMs} items={timeline!.items} selectedId={selectedItemId} onSelect={onSelectTimelineItem} />
        {timeline!.items.length === 0 && <p className="mt-3 font-serif italic text-text-muted">No events were recorded in this session.</p>}
      </div>

      <h2 className="mt-10 font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Key observations</h2>
      <div className="mt-3">
        {eventDetails.length === 0 && insights.length === 0 ? (
          <p className="font-serif italic text-text-muted">Not enough data in this session to highlight a pattern.</p>
        ) : (
          <KeyObservations details={eventDetails} fallbackInsights={insights} onJumpToEvent={jumpToEvent} />
        )}
      </div>

      {comparison && (
        <>
          <h2 className="mt-10 font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Progress</h2>
          <div className="mt-3">
            <ProgressNote comparison={comparison} />
          </div>
        </>
      )}

      <PrivacyNote className="mt-10">
        This report lists what was observed and counted. It never gives a score, and it stays on this device.
      </PrivacyNote>

      <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-border pt-6">
        <Button onClick={() => navigate("/calibrate")}>Start another session</Button>
        <Button variant="ghost" onClick={() => navigate("/home")}>
          Return to dashboard
        </Button>
        <Button variant="ghost" onClick={() => navigate("/reports")}>
          View previous sessions
        </Button>
      </div>
    </main>
  );
}
