import type { SessionComparison } from "@/lib/reports";

/**
 * Optional progress note against the most recent earlier session with the
 * same goal — rates only, no verdict and no claim of improvement
 * (`compareSessions` never returns one). Omitted entirely when there's
 * nothing comparable yet, rather than showing a misleading placeholder stat.
 */
export function ProgressNote({ comparison }: { comparison: SessionComparison }) {
  if (!comparison.comparable || !comparison.earlier || !comparison.later) {
    return comparison.reason ? <p className="font-serif italic text-text-muted">{comparison.reason}</p> : null;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return (
    <p className="font-serif text-text-muted">
      Your previous session with this goal measured {round1(comparison.earlier.deviationsPerMinute)} deviations and{" "}
      {round1(comparison.earlier.cuesPerMinute)} cues per minute; this one measured{" "}
      {round1(comparison.later.deviationsPerMinute)} and {round1(comparison.later.cuesPerMinute)}. This describes what was
      measured, not an improvement or decline.
    </p>
  );
}
