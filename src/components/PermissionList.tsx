import type { ReactNode } from "react";
import { SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";

/**
 * Pre-session access choices: each row says what is accessed, why, and where it
 * goes, with its own switch. Owner: Design System team. Nothing is requested
 * until the person starts; this only records their choices (PRD §4.4).
 */
export interface PermissionItem {
  key: string;
  label: string;
  help: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Shown instead of the switch, e.g. a link to calibrate first. */
  aside?: ReactNode;
}

export function PermissionList({ items, idBase }: { items: PermissionItem[]; idBase: string }) {
  return (
    <div className="border-t border-border">
      {items.map((p) => (
        <SettingRow key={p.key} label={p.label} help={p.help} helpId={`${idBase}-${p.key}-help`}>
          {p.aside ?? (
            <Toggle checked={p.checked} onChange={p.onChange} label={p.label} describedBy={`${idBase}-${p.key}-help`} disabled={p.disabled} />
          )}
        </SettingRow>
      ))}
    </div>
  );
}

/** Microphone permission problems, stated with what to do next. */
export function MicProblem({ state }: { state: "denied" | "unavailable" | string }) {
  if (state === "denied")
    return (
      <p role="alert" className="text-[14.5px] text-warning">
        The microphone is blocked. Allow microphone access for truely. in your browser or system settings, then try again.
      </p>
    );
  if (state === "unavailable")
    return (
      <p role="alert" className="text-[14.5px] text-warning">
        No microphone was found, or this browser can&apos;t record audio. Connect one, then try again. You can still type your answers.
      </p>
    );
  return null;
}
