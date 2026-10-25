/**
 * A small set of mutually exclusive choices as pill-shaped native radios.
 * The chosen option is marked with ✓ text, never color alone (CLAUDE.md §3).
 * Owner: Design System team. Used by FeedbackGroup and Profile settings.
 */
export interface Choice<V extends string> {
  value: V;
  label: string;
}

export function ChoiceGroup<V extends string>({
  name,
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  name: string;
  options: Choice<V>[];
  value?: V;
  onChange: (value: V) => void;
  labelledBy?: string;
  describedBy?: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-wrap gap-3">
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`inline-flex min-h-6 cursor-pointer items-center gap-2 rounded-pill border px-3 py-1 font-mono text-[12px] transition-colors duration-cue ease-cue has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              checked ? "border-text-primary text-text-primary" : "border-border text-text-muted hover:text-text-primary"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {checked && <span aria-hidden>✓</span>}
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
