import type { CueFeedback } from "@/types";

/**
 * "Was this cue helpful?" for one cue in the report (PRD §6 Screen D, §7.5).
 * A native radio group; the chosen answer is marked with text, not colour.
 * Skippable — no answer is a valid answer. Owner: Design System team.
 */
export const FEEDBACK_LABELS: Record<CueFeedback, string> = {
  helpful: "Helpful",
  not_helpful: "Not helpful",
  too_distracting: "Too distracting",
};

const OPTIONS = Object.keys(FEEDBACK_LABELS) as CueFeedback[];

export function FeedbackGroup({
  name,
  value,
  onChange,
}: {
  /** Unique per cue, e.g. the CoachingEvent id. */
  name: string;
  value?: CueFeedback;
  onChange: (feedback: CueFeedback) => void;
}) {
  return (
    <fieldset>
      <legend className="font-serif italic text-text-muted">Was this cue helpful?</legend>
      <div className="mt-2 flex flex-wrap gap-3">
        {OPTIONS.map((opt) => {
          const checked = value === opt;
          return (
            <label
              key={opt}
              className={`inline-flex min-h-6 cursor-pointer items-center gap-2 rounded-pill border px-3 py-1 font-mono text-[12px] transition-colors duration-cue ease-cue has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                checked ? "border-text-primary text-text-primary" : "border-border text-text-muted hover:text-text-primary"
              }`}
            >
              <input
                type="radio"
                name={`feedback-${name}`}
                value={opt}
                checked={checked}
                onChange={() => onChange(opt)}
                className="sr-only"
              />
              {checked && <span aria-hidden>✓</span>}
              {FEEDBACK_LABELS[opt]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
