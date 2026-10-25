import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ledger, LedgerRow } from "@/components/Ledger";
import { SettingRow } from "@/components/SettingRow";
import { Toggle } from "@/components/Toggle";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useProfileStore } from "@/state/profileStore";
import { deleteSessionHistory, resetBaseline, resetEverything } from "@/state/savedData";

/**
 * Data & privacy tab (PRD §4.4, §12). States plainly what is and isn't kept,
 * holds the saving consent, and offers deletion. Each destructive action is
 * confirmed in a dialog that names exactly what goes. Calm, never red.
 */
type Action = "history" | "baseline" | "everything";

const ACTIONS: Record<Action, { title: string; body: string; confirm: string; done: string; button: string }> = {
  history: {
    button: "Delete session history",
    title: "Delete session history?",
    body: "Every saved session on this device will be removed, with its transcript, notes and any recording. Your baseline, profile and settings stay.",
    confirm: "Delete history",
    done: "Session history deleted.",
  },
  baseline: {
    button: "Reset baseline",
    title: "Reset your baseline?",
    body: "truely. will forget your learned patterns and ask you to calibrate again before your next session. Saved reports stay.",
    confirm: "Reset baseline",
    done: "Baseline reset. You'll calibrate before your next session.",
  },
  everything: {
    button: "Reset everything",
    title: "Reset everything?",
    body: "Saved sessions, transcripts, recordings, your baseline, your communication profile and all settings will be removed, and truely. will start from first-time setup.",
    confirm: "Reset everything",
    done: "",
  },
};

export function DataPrivacy() {
  const navigate = useNavigate();
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const setConsent = useProfileStore((s) => s.setConsentSaveMetrics);
  const [pending, setPending] = useState<Action | null>(null);
  const [message, setMessage] = useState("");

  const confirm = async () => {
    const action = pending;
    setPending(null);
    if (action === "history") await deleteSessionHistory();
    if (action === "baseline") await resetBaseline();
    if (action === "everything") {
      await resetEverything();
      navigate("/");
      return;
    }
    if (action) setMessage(ACTIONS[action].done);
  };

  return (
    <div>
      <h2 className="font-display text-[22px]">What truely. keeps</h2>
      <Ledger className="mt-3">
        <LedgerRow label="By default">A video and audio recording of each session, with its transcript and notes, on this device for playback. Turn recording off before any session to skip it.</LedgerRow>
        <LedgerRow label="If you allow">Summaries and notes of sessions you didn&apos;t record, on this device.</LedgerRow>
        <LedgerRow label="Never">Camera frames on their own. They&apos;re analyzed on this device and discarded; only the recording keeps video.</LedgerRow>
        <LedgerRow label="Always">Your communication profile, goal and settings, so truely. remembers them.</LedgerRow>
      </Ledger>

      <h2 className="mt-10 font-display text-[22px]">What leaves this device</h2>
      <p className="mt-2 max-w-[62ch] text-[15px] text-text-muted">
        Only while you use a voice or profile feature: your speech goes to Cartesia to be transcribed and the coach&apos;s replies are
        spoken by Cartesia; transcript text goes to Moss to write suggestions and reports; a reference link goes to Apify to read its
        captions. Camera frames never leave the device.
      </p>

      <div className="mt-6 border-t border-border">
        <SettingRow
          label="Save sessions on this device"
          helpId="data-saving-help"
          help={
            consent
              ? "New sessions are kept so you can review them and truely. can refine your baseline."
              : "New sessions aren't kept after you close the tab. Turning this off doesn't delete what's already saved."
          }
        >
          <Toggle
            checked={consent}
            onChange={setConsent}
            label="Save sessions on this device"
            describedBy="data-saving-help"
          />
        </SettingRow>
      </div>

      <h2 className="mt-10 font-display text-[22px]">Delete data</h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-text-muted">
        These can&apos;t be undone. Each one asks you to confirm first.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4">
        {(Object.keys(ACTIONS) as Action[]).map((a) => (
          <Button key={a} variant="ghost" onClick={() => setPending(a)}>
            {ACTIONS[a].button}
          </Button>
        ))}
      </div>

      <p role="status" className="mt-5 min-h-[1.6em] font-serif italic text-text-muted">
        {message}
      </p>

      <ConfirmDialog
        open={pending != null}
        title={pending ? ACTIONS[pending].title : ""}
        confirmLabel={pending ? ACTIONS[pending].confirm : ""}
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      >
        {pending ? ACTIONS[pending].body : null}
      </ConfirmDialog>
    </div>
  );
}
