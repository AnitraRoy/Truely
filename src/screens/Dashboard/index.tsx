/**
 * Screen A: Dashboard (PRD §6 Screen A). Owner: Screen A team.
 * Intro + start a session. Premium, calm; no fabricated progress/scores.
 */
export function Dashboard() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Cue</h1>
      <p className="mt-4 text-xl text-text-muted">
        Show up as yourself. A little better every time.
      </p>
      {/* TODO(screen-a): start-session CTA, goal card, calibration status,
          recent-session summary, first-run empty state + privacy statement. */}
    </main>
  );
}
