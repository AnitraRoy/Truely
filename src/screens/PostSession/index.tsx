import { useNavigate } from "react-router-dom";
import { Masthead } from "@/components/Masthead";
import { Button } from "@/components/Button";
import { SpecimenPlate } from "@/components/SpecimenPlate";
import { Timeline } from "@/components/Timeline";
import { Ledger, LedgerRow } from "@/components/Ledger";
import yellowhammer from "@/assets/yellowhammer_final.png";

/**
 * Screen D: Post-Session Report (PRD §6 Screen D). Field Journal.
 * Observations only — no overall score, no claimed causation (PRD §6, §12).
 * The session/reports engines are not implemented yet, so there is no recorded
 * data: this renders an honest empty report (CLAUDE.md §5), never fabricated
 * counts, insights, or a timeline.
 */
export function PostSession() {
  const navigate = useNavigate();

  // Wire to lib/reports (createReportBuilder) once the session engine records data.
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Masthead
        folio={
          <>
            ENTRY — session report
            <br />
            self observation
          </>
        }
      />

      <section className="mt-7 grid items-start gap-x-[clamp(24px,4vw,48px)] gap-y-8 md:grid-cols-[1fr_200px]">
        <div>
          <h1 className="font-display text-[clamp(28px,4.4vw,40px)] font-semibold leading-tight">
            What the session recorded
          </h1>
          <p className="mt-2 max-w-[54ch] font-serif text-text-muted">
            Observations only — no overall score, and no claim that a cue caused a change.
          </p>
        </div>
        <SpecimenPlate
          src={yellowhammer}
          alt="Wood-engraving of a yellowhammer perched on a branch, after Thomas Bewick"
          title="ref. — field study"
          note="gaze"
          rotate={1.2}
          taped="left"
        />
      </section>

      <p className="mt-8 border-l-2 border-ochre pl-3.5 font-serif italic text-text-muted">
        No session has been filed yet. Once a session records events, its duration, counts, timeline,
        and observations are written up here.
      </p>

      <Ledger className="mt-8">
        <LedgerRow label="Duration"><span className="text-text-muted">—</span></LedgerRow>
        <LedgerRow label="Events"><span className="text-text-muted">—</span></LedgerRow>
        <LedgerRow label="Cues"><span className="text-text-muted">—</span></LedgerRow>
      </Ledger>

      <h2 className="mt-10 font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Behavioral timeline</h2>
      <div className="mt-3">
        <Timeline startMs={0} durationMs={0} entries={[]} />
        <p className="mt-3 font-serif italic text-text-muted">No events were recorded in this session.</p>
      </div>

      <h2 className="mt-9 font-mono text-[16px] uppercase tracking-[0.06em] text-text-muted">Session notes</h2>
      <p className="mt-2 font-serif italic text-text-muted">
        Observations appear here when the session records supporting data.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-6">
        <Button onClick={() => navigate("/calibrate")}>Start another session</Button>
        <Button variant="ghost" onClick={() => navigate("/")}>Return to dashboard</Button>
      </div>
    </main>
  );
}
