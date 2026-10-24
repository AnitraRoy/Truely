import type { ReactNode } from "react";

/**
 * One setting: a visible label, plain-language help, and its control on the
 * right. Ruled like the Ledger so Profile reads as the same journal.
 * Owner: Design System team. Pass `helpId` to the control's aria-describedby.
 */
export function SettingRow({
  label,
  help,
  helpId,
  children,
}: {
  label: string;
  help?: ReactNode;
  helpId?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 border-b border-border py-4">
      <div>
        <p className="font-display text-[18px] leading-snug">{label}</p>
        {help && (
          <p id={helpId} className="mt-1 max-w-[60ch] text-[15px] text-text-muted">
            {help}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
