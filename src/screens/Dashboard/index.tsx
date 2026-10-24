import { Link, useNavigate } from "react-router-dom";
import { useSessionStore } from "@/state/sessionStore";
import { useProfileStore } from "@/state/profileStore";
import { useSavedSessions } from "@/state/savedData";
import { GOAL_LABELS, GOAL_SIGNALS } from "@/config/coaching";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/Button";
import { Ledger, LedgerRow, LedgerValue } from "@/components/Ledger";
import { PrivacyNote } from "@/components/PrivacyNote";
import { formatDate, formatDuration, plural } from "@/components/format";

/**
 * Screen A: Dashboard (PRD §6 Screen A), the returning person's journal at
 * /home. Field Journal. The public introduction and the blue jay plate live on
 * the Landing page now. Honest states only — no fabricated progress, scores,
 * or history (PRD §6, CLAUDE.md §5).
 * Focal point: the headline and the start action; the ledger supports it and
 * recent sessions sit in the narrow column.
 */
const RECENT = 3;

export function Dashboard() {
  const navigate = useNavigate();
  const goal = useSessionStore((s) => s.goal);
  const isCalibrated = useSessionStore((s) => s.isCalibrated);
  const setupComplete = useProfileStore((s) => s.setupComplete);
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const saved = useSavedSessions();
  const sessions = saved.status === "ready" ? saved.sessions : [];

  const signals = goal ? GOAL_SIGNALS[goal].map((s) => s.replace(/_/g, " ")).join(" and ") : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <SiteNav />

      <div className="mt-10 grid items-start gap-x-[clamp(28px,5vw,72px)] gap-y-12 md:mt-14 md:grid-cols-[minmax(0,1fr)_260px]">
        <section aria-labelledby="home-title">
          <h1
            id="home-title"
            className="font-display text-[clamp(40px,7vw,78px)] font-semibold leading-[0.98] tracking-[-0.02em]"
          >
            Ready when
            <br />
            you are.
          </h1>
          <p className="mt-4 max-w-[38ch] font-serif text-[clamp(18px,2.3vw,22px)] italic leading-snug text-text-muted">
            {setupComplete
              ? "Start a session whenever you're about to be on camera, or before one to warm up."
              : "Finish setup first so Cue can learn your normal before it offers any cues."}
          </p>
          <div className="mt-8">
            <Button onClick={() => navigate(setupComplete ? "/calibrate" : "/start")}>
              {setupComplete ? "Start a session" : "Continue setup"}
            </Button>
          </div>

          <Ledger className="mt-14">
            <LedgerRow
              label="Goal"
              meta={
                <Link to="/profile" className="font-serif italic underline decoration-1 underline-offset-4 hover:text-accent">
                  Change
                </Link>
              }
            >
              {goal ? (
                <>
                  <LedgerValue>{GOAL_LABELS[goal]}</LedgerValue>
                  <span className="mt-0.5 block text-[14.5px] text-text-muted">Prioritizes {signals}</span>
                </>
              ) : (
                <span className="text-text-muted">Not chosen yet. You&apos;ll pick one in setup.</span>
              )}
            </LedgerRow>

            <LedgerRow label="Baseline">
              {isCalibrated ? (
                <>
                  <LedgerValue>Calibrated</LedgerValue>
                  <span className="mt-0.5 block text-[14.5px] text-text-muted">Learned from your natural patterns</span>
                </>
              ) : (
                <span className="text-text-muted">
                  Not calibrated yet. A short calibration runs before your next session.
                </span>
              )}
            </LedgerRow>
          </Ledger>
        </section>

        <aside aria-labelledby="recent-title" className="md:pt-3">
          <h2 id="recent-title" className="font-display text-[20px] leading-snug">
            Recent sessions
          </h2>
          {sessions.length > 0 ? (
            <>
              <ul className="mt-3 border-t border-border">
                {sessions.slice(0, RECENT).map((s) => (
                  <li key={s.id} className="border-b border-border py-3">
                    <Link
                      to={`/report/${encodeURIComponent(s.id)}`}
                      className="font-display text-[17px] underline decoration-border decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent"
                    >
                      {formatDate(s.startedAt)}
                    </Link>
                    <span className="block text-[14px] text-text-muted">
                      {formatDuration(s.durationMs)}, {plural(s.cueCount, "cue")}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/reports" className="mt-3 inline-block font-serif italic underline decoration-1 underline-offset-4 hover:text-accent">
                All reports
              </Link>
            </>
          ) : (
            <p className="mt-3 font-serif italic text-text-muted">
              {consent
                ? "Nothing filed yet. Your sessions will be listed here."
                : "Saving is off, so past sessions aren't listed."}{" "}
              {!consent && (
                <Link to="/profile?tab=data" className="not-italic underline decoration-1 underline-offset-4 hover:text-accent">
                  Change this
                </Link>
              )}
            </p>
          )}

          <PrivacyNote className="mt-10" />
        </aside>
      </div>
    </main>
  );
}
