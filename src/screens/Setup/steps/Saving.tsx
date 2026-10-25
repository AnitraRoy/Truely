import type { RefObject } from "react";
import { SettingRow } from "@/components/SettingRow";
import { Toggle } from "@/components/Toggle";
import { StepHeading } from "./StepHeading";

/**
 * Step 3: consent to save session metrics (PRD §4.4). Off by default; declining
 * is a full path — sessions then live only until the tab closes.
 */
export function SavingStep({
  headingRef,
  consent,
  onChange,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  consent: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <StepHeading headingRef={headingRef} size="md">
        Keep a record of your sessions?
      </StepHeading>
      <p className="mt-3 max-w-[56ch] text-text-muted">
        Saving lets you look back at past reports and lets truely. refine your baseline over time. It&apos;s
        optional. truely. coaches the same way either way.
      </p>

      <div className="mt-6 border-t border-border">
        <SettingRow
          label="Save session summaries on this device"
          helpId="setup-saving-help"
          help={
            consent
              ? "Durations, counts, cue timings, and your cue feedback are kept in this browser. Never video or images."
              : "Nothing is kept after you close the tab. Reports are still shown at the end of each session."
          }
        >
          <Toggle
            checked={consent}
            onChange={onChange}
            label="Save session summaries on this device"
            describedBy="setup-saving-help"
          />
        </SettingRow>
      </div>

      <p className="mt-4 font-serif italic text-text-muted">
        You can change this, or delete everything saved, from your profile.
      </p>
    </div>
  );
}
