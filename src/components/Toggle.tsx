/**
 * On/off switch (ARIA `switch`). The state is spelled out as "On"/"Off" beside
 * the track, so it never relies on colour or knob position alone (CLAUDE.md §3).
 * Owner: Design System team.
 */
export function Toggle({
  checked,
  onChange,
  label,
  id,
  describedBy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name — usually the SettingRow label. */
  label: string;
  id?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-6 items-center gap-3 disabled:opacity-40"
    >
      <span
        aria-hidden
        className={`relative h-[18px] w-[34px] rounded-pill border transition-colors duration-cue ease-cue ${
          checked ? "border-text-primary bg-text-primary" : "border-border bg-transparent"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[12px] w-[12px] rounded-pill transition-[left] duration-cue ease-cue ${
            checked ? "left-[18px] bg-bg" : "left-[2px] bg-text-muted"
          }`}
        />
      </span>
      <span className="w-7 text-left font-mono text-[12px] text-text-muted">{checked ? "On" : "Off"}</span>
    </button>
  );
}
