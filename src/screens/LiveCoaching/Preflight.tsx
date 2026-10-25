import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { PermissionList } from "@/components/PermissionList";
import { SectionTitle, Sheet } from "@/components/Sheet";
import { hasDesktopBridge, useServiceStatus } from "@/components/useServiceStatus";
import { useSessionStore } from "@/state/sessionStore";

/**
 * Live coaching preflight: the person chooses exactly what this session may
 * access before anything turns on (PRD §4.4; Stage 4 privacy requirement).
 * Nothing is requested here; the browser asks when the session starts.
 * Recording is off by default and needs everyone's agreement.
 */
export interface LiveChoices {
  title: string;
  microphone: boolean;
  camera: boolean;
  record: boolean;
}

export function Preflight({ onStart }: { onStart: (c: LiveChoices) => void }) {
  const calibrated = useSessionStore((s) => s.isCalibrated);
  const services = useServiceStatus();
  const desktop = hasDesktopBridge();
  const canListen = Boolean(services?.cartesia);

  const [title, setTitle] = useState("");
  const [microphone, setMicrophone] = useState(false);
  const [camera, setCamera] = useState(true);
  const [record, setRecord] = useState(true);
  const [agreed, setAgreed] = useState(false);

  // Default the microphone on only where it can actually work.
  useEffect(() => setMicrophone(canListen), [canListen]);

  const blocked = (!microphone && !camera) || (record && !agreed);

  return (
    <AppShell art={{ plate: "yellowhammer" }}>
      <PageHeader
        step="Step 4 of 4: in the moment"
        title="Stay present in the conversation."
        lede="Live coaching is discreet: a small note now and then, never a script. Choose what Cue can use for this session."
      />

      <div className="mt-10 grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,1fr)]">
        <Sheet aria-labelledby="choice-title" className="px-6 py-7 md:px-9 md:py-9">
          <SectionTitle id="choice-title">Your session, your choice</SectionTitle>
          <p className="mt-1 text-[14.5px] text-text-muted">Each switch applies to this session only. You can pause or end at any time.</p>

          <div className="mt-6 max-w-md">
            <TextField label="What's this conversation? (optional)" placeholder="Team project check-in" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="mt-7">
            <PermissionList
              idBase="live"
              items={[
                {
                  key: "mic",
                  label: "Microphone",
                  help: canListen
                    ? "Transcribes the conversation with Cartesia so Cue can offer an occasional suggestion (written by Moss). Audio isn't kept unless you record."
                    : desktop
                      ? "Live transcription needs Cartesia, which isn't set up yet."
                      : "Live transcription needs the Cue desktop app.",
                  checked: microphone,
                  onChange: setMicrophone,
                  disabled: !canListen,
                },
                {
                  key: "camera",
                  label: "Camera signals",
                  help: calibrated
                    ? "Compares your head and gaze to your calibrated baseline, on this device, for discreet cues and your report. Frames are never uploaded."
                    : "Shows your camera and includes it in the recording. Calibrate first to also get cues from your head and gaze.",
                  checked: camera,
                  onChange: setCamera,
                  aside: calibrated ? undefined : (
                    <Link to="/calibrate" className="text-[14px] underline underline-offset-4 hover:text-accent">
                      Calibrate first
                    </Link>
                  ),
                },
                {
                  key: "record",
                  label: "Save a recording",
                  help: "On by default. Video and audio (whichever is on), kept on this device so you can play moments back in the report.",
                  checked: record,
                  onChange: setRecord,
                  disabled: !microphone && !camera,
                },
              ]}
            />
          </div>

          {record && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-[15px]">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-accent" />
              <span>Everyone in this conversation has agreed to be recorded.</span>
            </label>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
            <Button onClick={() => onStart({ title: title.trim(), microphone, camera, record: record && (microphone || camera) })} disabled={blocked}>
              Start live coaching
            </Button>
            <p className="text-[13.5px] text-text-muted" aria-live="polite">
              {!microphone && !camera
                ? "Turn on the microphone or camera signals to start."
                : record && !agreed
                  ? "Confirm everyone agreed, or turn recording off."
                  : "Your browser will ask for access when you start."}
            </p>
          </div>
        </Sheet>

        <aside aria-labelledby="during-title" className="lg:pt-3">
          <SectionTitle id="during-title">What you&apos;ll see</SectionTitle>
          <ul className="mt-3 border-t border-border">
            {[
              ["During", "Your preview or the transcript, and a small note in the margin only when it's useful. Notes fade on their own."],
              ["Control", "Pause stops all listening and measuring. End stops everything at once."],
              ["Afterwards", "A summary, the moments worth revisiting with timestamps, and the transcript if the microphone was on."],
              ["Be considerate", "Use live assistance only where it's allowed, and let others know if Cue is listening."],
            ].map(([k, v]) => (
              <li key={k} className="border-b border-border py-3">
                <p className="text-[13px] text-text-muted">{k}</p>
                <p className="text-[15px]">{v}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
