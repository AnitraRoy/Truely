import { FEEDBACK_CATEGORY_LABELS } from "@/config/conversation";
import type { FeedbackCategory } from "@/types";

/**
 * One coaching suggestion: what aspect it's about (in words), a short
 * imperative, why, and an optional phrasing to try. Owner: Design System team.
 * Suggestions are optional nudges, never verdicts (CLAUDE.md §5).
 *
 * `compact` is the live-conversation form: smaller, a single line of reason,
 * meant to be read at a glance and dismissed.
 */
export function SuggestionNote({
  category,
  title,
  explanation,
  suggestion,
  onDismiss,
  compact = false,
  sample = false,
}: {
  category: FeedbackCategory;
  title: string;
  explanation?: string;
  suggestion?: string;
  onDismiss?: () => void;
  compact?: boolean;
  /** Development sample, labelled as such. */
  sample?: boolean;
}) {
  return (
    <article className={`relative border-l-2 border-accent ${compact ? "py-1 pl-3.5 pr-9" : "py-1.5 pl-4 pr-9"}`}>
      <p className="text-[12.5px] text-text-muted">
        {FEEDBACK_CATEGORY_LABELS[category]}
        {sample && <span className="ml-2 text-ochre">sample</span>}
      </p>
      <h3 className={`mt-0.5 font-display font-semibold leading-snug ${compact ? "text-[17px]" : "text-[18.5px]"}`}>{title}</h3>
      {explanation && <p className={`mt-1 text-text-muted ${compact ? "text-[14px]" : "text-[14.5px]"}`}>{explanation}</p>}
      {suggestion && !compact && (
        <p className="mt-1.5 font-serif text-[15.5px] italic">
          Try: <span className="not-italic">&ldquo;{suggestion.replace(/^["“]|["”]$/g, "")}&rdquo;</span>
        </p>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss suggestion: ${title}`}
          className="absolute right-0 top-0 grid h-8 w-8 place-items-center rounded text-text-muted transition-colors duration-cue-fast ease-cue hover:bg-sunken hover:text-text-primary"
        >
          ✕
        </button>
      )}
    </article>
  );
}
