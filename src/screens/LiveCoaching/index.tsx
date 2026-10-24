import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/state/sessionStore";
import { Button } from "@/components/Button";
import { FloatingOverlay } from "@/components/FloatingOverlay";
import { StatusChip } from "@/components/StatusChip";
import { useFloatingOverlay } from "@/components/useFloatingOverlay";
import { CueBubble } from "@/components/CueBubble";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { WebcamFrame } from "@/components/WebcamFrame";
import { SessionOverlay } from "./SessionOverlay";
import { useSampleCues } from "./useSampleCues";

/**
 * Screen C: Live Coaching (PRD §6 Screen C) — the most important screen.
 * Field Journal. CLAUDE.md §6: the camera preview is the focal point, cues are
 * discreet (a margin annotation via <CueBubble> — shown only when the coaching
 * engine emits one; never fabricated, CLAUDE.md §5), status stays secondary.
 *
 * "Float cues over" moves cues into a small always-on-top window (<SessionOverlay>)
 * so the person sees them over their meeting. The preview and controls stay here.
 * In the desktop shell that window is also kept out of screen shares
 * (useFloatingOverlay). Until the coaching engine is wired in, cues are labelled
 * samples rotated from config (useSampleCues).
 */
/** The overlay holds one cue: wide enough for two lines of cue copy. */
const OVERLAY_SIZE = { width: 380, height: 150 };

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveCoaching() {
  const navigate = useNavigate();
  const status = useSessionStore((s) => s.status);
  const setStatus = useSessionStore((s) => s.setStatus);
  const { videoRef, state, enable, disable } = useWebcamPreview();
  const overlay = useFloatingOverlay({ title: "Cue", ...OVERLAY_SIZE });
  const desktop = overlay.desktop;
  const floating = overlay.overlayWindow != null;

  const live = state === "live";
  const paused = status === "paused";
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  // While floating, this tab is usually hidden and its timers get throttled;
  // the overlay window stays visible, so timers run on its clock instead.
  const clock = overlay.overlayWindow ?? window;
  const samples = useSampleCues({ active: live && !paused, clock });

  // Consent was given during calibration; the browser remembers the grant.
  useEffect(() => {
    void enable();
  }, [enable]);

  useEffect(() => {
    if (live && startRef.current == null) {
      startRef.current = Date.now();
      setStatus("observing");
    }
  }, [live, setStatus]);

  useEffect(() => {
    if (!live) return;
    const id = clock.setInterval(() => {
      if (startRef.current != null && !paused) setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => clock.clearInterval(id);
  }, [live, paused, clock]);

  const togglePause = () => setStatus(paused ? "observing" : "paused");

  function end() {
    overlay.close();
    disable();
    setStatus("ended");
    navigate("/report/local");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <span className="font-display text-[20px] font-semibold">
          Cue<span className="text-ochre">.</span>
        </span>
        <StatusChip status={live ? status : "ready"} />
      </header>

      <div className="mt-6 grid items-start gap-7 md:grid-cols-[1fr_220px]">
        {/* focal point: the preview, largest + highest contrast */}
        <WebcamFrame videoRef={videoRef} state={state} />

        {/* secondary: quiet field notes in the margin */}
        <aside className="border-l border-border pl-5">
          <h2 className="font-mono text-[13px] uppercase tracking-[0.06em] text-text-muted">Field notes</h2>
          <p className="mt-2.5 font-serif text-[15px] italic leading-snug">
            Observing against your baseline. Cue stays quiet until it sees a sustained change.
          </p>

          <dl className="mt-5 space-y-2.5 font-mono text-[12px] text-text-muted">
            <div className="flex items-center gap-2">
              <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${live ? "bg-positive" : "bg-text-muted"}`} />
              {live ? "camera on · local" : "camera off"}
            </div>
            <div>⏱&nbsp; {fmt(elapsed)}</div>
            <div>—&nbsp; sample cues only, nothing recorded</div>
          </dl>

          {/* the cue, as a margin annotation; it moves to the overlay while floating */}
          {!floating && samples.cue && (
            <div className="mt-5">
              <CueBubble key={samples.cue.id} text={samples.cue.text} label="sample" onDismiss={samples.dismiss} />
            </div>
          )}

          {floating && (
            <div className="mt-5 space-y-2 font-serif text-[14px] italic leading-snug text-text-muted">
              <p className="m-0">
                {desktop
                  ? `Cues are floating above your other windows${desktop.contentProtected ? ", hidden from most screen shares and recordings" : ""}.`
                  : "Cues are floating above your other tabs."}
              </p>
              {desktop && (
                <p className="m-0">
                  {desktop.hidden
                    ? `The overlay is hidden. ${desktop.shortcuts.toggleHidden} shows it.`
                    : desktop.clickThrough
                      ? `Clicks pass through the overlay. ${desktop.shortcuts.toggleClickThrough} turns this off.`
                      : `${desktop.shortcuts.toggleHidden} hides it, ${desktop.shortcuts.toggleClickThrough} lets clicks pass through.`}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {overlay.supported ? (
              floating ? (
                <Button variant="ghost" onClick={overlay.close}>
                  Show cues here instead
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => void overlay.open()} disabled={!live}>
                  {overlay.mode === "desktop" ? "Float cues over other windows" : "Float cues over other tabs"}
                </Button>
              )
            ) : (
              <p className="m-0 font-serif text-[14px] italic text-text-muted">
                To float cues over your other tabs, use Chrome, Edge, or the Cue desktop app.
              </p>
            )}
            <Button variant="ghost" onClick={togglePause} disabled={!live}>
              {paused ? "Resume coaching" : "Pause coaching"}
            </Button>
            <Button onClick={end} className="w-full text-center">
              End session
            </Button>
          </div>
        </aside>
      </div>

      {overlay.overlayWindow && (
        <FloatingOverlay target={overlay.overlayWindow}>
          <SessionOverlay
            cue={samples.cue}
            paused={paused}
            onDismiss={samples.dismiss}
            draggable={overlay.mode === "desktop"}
            onDock={overlay.mode === "desktop" ? overlay.close : undefined}
          />
        </FloatingOverlay>
      )}
    </main>
  );
}
