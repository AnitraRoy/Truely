import { useNavigate } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { PrivacyNote } from "@/components/PrivacyNote";
import { useProfileStore } from "@/state/profileStore";
import { useSavedSessions } from "@/state/savedData";
import { SessionList } from "./SessionList";
import { plural } from "@/components/format";

/**
 * Session history (docs/FRONTEND_GUIDE.md §3.4). Field Journal.
 * Lists saved sessions newest first; each opens its report. Empty stays
 * honestly empty, and says why when saving is off (CLAUDE.md §5).
 * Focal point: the title and the register.
 */
export function Reports() {
  const navigate = useNavigate();
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const setupComplete = useProfileStore((s) => s.setupComplete);
  const saved = useSavedSessions();
  const sessions = saved.status === "ready" ? saved.sessions : [];
  const startSession = () => navigate(setupComplete ? "/calibrate" : "/start");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <SiteNav />

      <div className="mt-10 grid items-start gap-x-[clamp(24px,4vw,56px)] gap-y-8 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <h1 className="font-display text-[clamp(34px,5vw,52px)] font-semibold leading-[1.02] tracking-[-0.015em]">
            Session reports
          </h1>
          <p className="mt-3 text-text-muted" aria-live="polite">
            {saved.status === "loading"
              ? "Opening your saved sessions…"
              : sessions.length > 0
                ? `${plural(sessions.length, "session")} saved on this device, newest first.`
                : "Each saved session gets a report you can come back to."}
          </p>

          <div className="mt-8">
            {saved.status === "loading" ? null : sessions.length > 0 ? (
              <SessionList sessions={sessions} />
            ) : consent ? (
              <EmptyState
                title="No sessions filed yet"
                action={<Button onClick={startSession}>Start a session</Button>}
              >
                Your next session will be listed here when it ends.
              </EmptyState>
            ) : (
              <EmptyState
                title="No sessions saved"
                action={
                  <div className="flex flex-wrap items-center gap-6">
                    <Button onClick={() => navigate("/profile?tab=data")}>Turn on saving</Button>
                    <Button variant="ghost" onClick={startSession}>
                      Start a session
                    </Button>
                  </div>
                }
              >
                Saving is off, so sessions aren&apos;t kept after you close the tab. You still see each report
                when a session ends.
              </EmptyState>
            )}
          </div>
        </div>

        <aside className="md:pt-[88px]">
          <PrivacyNote>
            Reports list what was observed and counted. They never give a score, and they stay on this
            device.
          </PrivacyNote>
        </aside>
      </div>
    </main>
  );
}
