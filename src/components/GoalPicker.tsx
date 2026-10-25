import { GOAL_LABELS, GOAL_SIGNALS } from "@/config/coaching";
import type { CoachingGoal } from "@/types";
import { Pill } from "./Pill";

/**
 * Pick one primary coaching goal (PRD §6 Screen B, one goal for the MVP).
 * Native radios, so arrow keys and form semantics come for free. The selected
 * row says "selected" in text, never colour alone. Owner: Design System team.
 */
const GOALS = Object.keys(GOAL_LABELS) as CoachingGoal[];

/** "a", "a and b", "a, b and c". */
const listOf = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function GoalPicker({
  value,
  onChange,
  name = "coaching-goal",
  labelledBy,
}: {
  value: CoachingGoal | null;
  onChange: (goal: CoachingGoal) => void;
  name?: string;
  labelledBy?: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="border-t border-border">
      {GOALS.map((g) => {
        const selected = value === g;
        return (
          <label
            key={g}
            className={`grid cursor-pointer grid-cols-[1fr_auto] items-baseline gap-4 border-b border-border px-1 py-4 transition-colors duration-cue ease-cue hover:bg-surface has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              selected ? "bg-surface" : ""
            }`}
          >
            <input
              type="radio"
              name={name}
              value={g}
              checked={selected}
              onChange={() => onChange(g)}
              className="sr-only"
            />
            <span>
              <span className="font-display text-[20px]">{GOAL_LABELS[g]}</span>
              <br />
              <span className="text-[14.5px] text-text-muted">
                Prioritizes {listOf(GOAL_SIGNALS[g].map((s) => s.replace(/_/g, " ")))}
              </span>
            </span>
            {selected && <Pill tone="positive">selected</Pill>}
          </label>
        );
      })}
    </div>
  );
}
