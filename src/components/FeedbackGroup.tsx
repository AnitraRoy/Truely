import type { CueFeedback } from "@/types";
import { ChoiceGroup } from "./ChoiceGroup";

/**
 * "Was this cue helpful?" for one cue in the report (PRD §6 Screen D, §7.5).
 * Skippable — no answer is a valid answer. Owner: Design System team.
 */
export const FEEDBACK_LABELS: Record<CueFeedback, string> = {
  helpful: "Helpful",
  not_helpful: "Not helpful",
  too_distracting: "Too distracting",
};

const OPTIONS = (Object.keys(FEEDBACK_LABELS) as CueFeedback[]).map((value) => ({
  value,
  label: FEEDBACK_LABELS[value],
}));

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
      <div className="mt-2">
        <ChoiceGroup name={`feedback-${name}`} options={OPTIONS} value={value} onChange={onChange} />
      </div>
    </fieldset>
  );
}
