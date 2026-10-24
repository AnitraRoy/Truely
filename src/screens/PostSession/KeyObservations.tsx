import type { EventDetail } from "@/lib/reports";
import { formatClock } from "@/components/videoReview/time";

/**
 * Up to two field notes, each grounded in a recorded event (`buildEventDetail`):
 * what was measured, the evidence behind it, and one practical next step —
 * never a score, never a claim that the cue caused anything (CLAUDE.md §5).
 *
 * The timestamp jumps to that moment in the behavioral timeline below; there's
 * no recorded video to seek in a real session (see `components/videoReview`).
 */
export function KeyObservations({
  details,
  fallbackInsights,
  onJumpToEvent,
}: {
  details: EventDetail[];
  fallbackInsights: string[];
  onJumpToEvent: (eventId: string) => void;
}) {
  if (details.length === 0 && fallbackInsights.length === 0) return null;

  return (
    <div className="space-y-5">
      {details.map((d) => (
        <article key={d.eventId} className="border border-border bg-surface p-4">
          <button
            type="button"
            onClick={() => onJumpToEvent(d.eventId)}
            className="font-mono text-[12px] tabular-nums text-ochre underline decoration-ochre/40 underline-offset-4 hover:decoration-ochre"
          >
            {formatClock(d.offsetMs)} — jump to this moment
          </button>

          <dl className="mt-3 space-y-3">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Observation</dt>
              <dd className="mt-1 font-serif text-[15.5px]">{d.observation}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Evidence</dt>
              <dd className="mt-1 font-serif text-[15.5px] text-text-muted">{d.afterwards}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Possible next step</dt>
              <dd className="mt-1 font-serif text-[15.5px] italic">{d.cueText}</dd>
            </div>
          </dl>
        </article>
      ))}

      {fallbackInsights.length > 0 && (
        <ul className="space-y-2">
          {fallbackInsights.map((text, i) => (
            <li key={i} className="border-l-2 border-border pl-3.5 font-serif italic text-text-muted">
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
