import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/state/sessionStore";
import { GOAL_LABELS, GOAL_SIGNALS } from "@/config/coaching";
import { Masthead } from "@/components/Masthead";
import { Button } from "@/components/Button";
import { SpecimenPlate } from "@/components/SpecimenPlate";
import { Ledger, LedgerRow, LedgerValue } from "@/components/Ledger";
import { Pill } from "@/components/Pill";
import { PrivacyNote } from "@/components/PrivacyNote";
import bluejay from "@/assets/bluejay_final.jpg";

/**
 * Screen A: Dashboard (PRD §6 Screen A). Field Journal art direction.
 * Honest states only — no fabricated progress, scores, or history (PRD §6,
 * CLAUDE.md §5). Focal point: the oversize headline + the specimen plate.
 */
export function Dashboard() {
  const navigate = useNavigate();
  const goal = useSessionStore((s) => s.goal);
  const isCalibrated = useSessionStore((s) => s.isCalibrated);

  const signals = goal ? GOAL_SIGNALS[goal].join(" · ").replace(/_/g, " ") : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <Masthead
        folio={
          <>
            FIELD JOURNAL
            <br />
            No.&nbsp;001 — self observation
          </>
        }
      />

      <section className="mt-8 grid items-start gap-x-[clamp(26px,4vw,58px)] gap-y-10 md:grid-cols-[1fr_minmax(280px,380px)]">
        <div>
          <h1 className="font-display text-[clamp(40px,7vw,78px)] font-semibold leading-[0.98] tracking-[-0.02em]">
            Show up
            <br />
            as yourself.
          </h1>
          <p className="mt-4 max-w-[32ch] font-serif text-[clamp(18px,2.3vw,23px)] italic leading-snug text-text-muted">
            A field journal for your on-camera habits — Cue records what you do, session by session,
            so you can study it in your own time.
          </p>
          <div className="mt-8">
            <Button onClick={() => navigate("/calibrate")}>Start a session</Button>
          </div>
        </div>

        <SpecimenPlate
          src={bluejay}
          alt="Hand-coloured engraving of blue jays on a branch with trumpet flowers, after J. J. Audubon"
          title="Plate CII — Corvus cristatus"
          note="hand-coloured"
        />
      </section>

      <Ledger className="mt-12">
        <LedgerRow label="Goal" meta={goal ? <Pill tone="positive">selected</Pill> : "not set"}>
          {goal ? (
            <>
              <LedgerValue>{GOAL_LABELS[goal]}</LedgerValue>
              <br />
              <span className="font-mono text-[12px] text-text-muted">prioritizes {signals}</span>
            </>
          ) : (
            <span className="text-text-muted">Choose a goal when you start a session.</span>
          )}
        </LedgerRow>

        <LedgerRow label="Baseline" meta={isCalibrated ? "updated today" : undefined}>
          {isCalibrated ? (
            <>
              <LedgerValue>Calibrated</LedgerValue>
              <br />
              <span className="font-mono text-[12px] text-text-muted">learned from your natural patterns</span>
            </>
          ) : (
            <span className="text-text-muted">
              Not calibrated yet — a short calibration draws your baseline before any cues.
            </span>
          )}
        </LedgerRow>

        <LedgerRow label="Sessions">
          <span className="text-text-muted">No sessions filed yet. Your first run will be recorded here.</span>
        </LedgerRow>
      </Ledger>

      <PrivacyNote className="mt-7" />
    </main>
  );
}
