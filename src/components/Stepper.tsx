/**
 * Text-first progress for the setup wizard: "Step 2 of 5: Goal" plus the full
 * list for assistive tech. Position is stated in words, never color alone.
 * Owner: Design System team. `current` is zero-based.
 */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div>
      <p className="font-mono text-[12px] text-text-muted">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
      <ol className="mt-2 flex gap-2" aria-label="Setup progress">
        {steps.map((name, i) => (
          <li
            key={name}
            aria-current={i === current ? "step" : undefined}
            className={`h-[3px] flex-1 ${i <= current ? "bg-text-primary" : "bg-border"}`}
          >
            <span className="sr-only">
              {name}
              {i < current ? " (done)" : i === current ? " (current)" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
