import type { RefObject } from "react";
import { SpecimenPlate } from "@/components/SpecimenPlate";
import { Ledger, LedgerRow } from "@/components/Ledger";
import { PrivacyNote } from "@/components/PrivacyNote";
import yellowhammer from "@/assets/yellowhammer_final.png";
import { StepHeading } from "./StepHeading";

/** Step 1: what Cue does with the camera, before it asks for anything. The wizard's one plate. */
export function WelcomeStep({ headingRef }: { headingRef: RefObject<HTMLHeadingElement> }) {
  return (
    <div className="grid items-start gap-x-[clamp(24px,4vw,56px)] gap-y-10 md:grid-cols-[1fr_220px]">
      <div>
        <StepHeading headingRef={headingRef}>
          Before we start,
          <br />
          here&apos;s what stays with you.
        </StepHeading>
        <p className="mt-4 max-w-[46ch] font-serif text-[clamp(17px,2vw,20px)] italic leading-snug text-text-muted">
          Setup takes about two minutes. Cue learns your usual on-camera patterns first, so later cues
          respond to you, not to a generic standard.
        </p>

        <Ledger className="mt-8">
          <LedgerRow label="Processed">Everything runs in this browser, on this device.</LedgerRow>
          <LedgerRow label="Recorded">Each session&apos;s video and audio, kept on this device so you can play it back. On by default; turn it off before any session.</LedgerRow>
          <LedgerRow label="Saved">Only if you allow it: session counts, cue timings, and your feedback.</LedgerRow>
          <LedgerRow label="Never uploaded">Your recordings and camera frames. They stay on this device.</LedgerRow>
        </Ledger>

        <PrivacyNote className="mt-6" />
      </div>

      <SpecimenPlate
        src={yellowhammer}
        alt="Wood-engraving of a yellowhammer perched on a branch, after Thomas Bewick"
        title="ref. — field study"
        rotate={1.2}
        taped="left"
        className="hidden md:block"
      />
    </div>
  );
}
