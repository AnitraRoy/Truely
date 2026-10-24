import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/state/sessionStore";
import { Button } from "@/components/Button";
import { StatusChip } from "@/components/StatusChip";
import { useWebcamPreview } from "@/components/useWebcamPreview";
import { WebcamFrame } from "@/components/WebcamFrame";

/**
 * Screen C: Live Coaching (PRD §6 Screen C) — the most important screen.
 * Field Journal. CLAUDE.md §6: the camera preview is the focal point, cues are
 * discreet (a margin annotation via <CueBubble> — shown only when the coaching
 * engine emits one; never fabricated, CLAUDE.md §5), status stays secondary.
 */
function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveCoaching() {
  const navigate = useNavigate();
  const status = useSessionStore((s) => s.status);
  const setStatus = useSessionStore((s) => s.setStatus);
  const { videoRef, state, enable, disable } = useWebcamPreview();

  const live = state === "live";
  const paused = status === "paused";
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

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
    const id = window.setInterval(() => {
      if (startRef.current != null && !paused) setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [live, paused]);

  function end() {
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
            <div>—&nbsp; no cues this session</div>
          </dl>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="ghost"
              onClick={() => setStatus(paused ? "observing" : "paused")}
              disabled={!live}
            >
              {paused ? "Resume coaching" : "Pause coaching"}
            </Button>
            <Button onClick={end} className="w-full text-center">
              End session
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
