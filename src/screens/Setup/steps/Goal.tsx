import type { RefObject } from "react";
import type { CoachingGoal } from "@/types";
import { GoalPicker } from "@/components/GoalPicker";
import { StepHeading } from "./StepHeading";

/** Step 2: one primary goal (PRD §6 Screen B). Changeable later in Profile. */
export function GoalStep({
  headingRef,
  goal,
  onChange,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  goal: CoachingGoal | null;
  onChange: (goal: CoachingGoal) => void;
}) {
  return (
    <div>
      <StepHeading headingRef={headingRef} size="md">
        <span id="setup-goal-heading">What would you like to work on?</span>
      </StepHeading>
      <p className="mt-3 max-w-[56ch] text-text-muted">
        Your goal decides which observable signals Cue pays attention to. Pick one; you can change it
        any time.
      </p>
      <div className="mt-6">
        <GoalPicker value={goal} onChange={onChange} labelledBy="setup-goal-heading" />
      </div>
      <p className="mt-3 font-serif italic text-text-muted">
        Looking at the camera all the time isn&apos;t the goal. Cue learns your own normal.
      </p>
    </div>
  );
}
