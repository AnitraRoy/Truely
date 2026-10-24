import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GOAL_LABELS } from "@/config/coaching";
import { Ledger, LedgerRow, LedgerValue } from "@/components/Ledger";
import { Button } from "@/components/Button";
import { GoalPicker } from "@/components/GoalPicker";
import { useProfileStore } from "@/state/profileStore";
import { useSessionStore } from "@/state/sessionStore";
import { useSavedSessions } from "@/state/savedData";

/** Overview tab: where things stand, plus the two most common changes. Honest values only. */
export function Overview({ onOpenTab }: { onOpenTab: (tab: "settings" | "data") => void }) {
  const navigate = useNavigate();
  const [editingGoal, setEditingGoal] = useState(false);
  const goal = useProfileStore((s) => s.primaryGoal);
  const setPrimaryGoal = useProfileStore((s) => s.setPrimaryGoal);
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const setupComplete = useProfileStore((s) => s.setupComplete);
  const setSessionGoal = useSessionStore((s) => s.setGoal);
  const isCalibrated = useSessionStore((s) => s.isCalibrated);
  const saved = useSavedSessions();
  const count = saved.status === "ready" ? saved.sessions.length : 0;

  const sessionsText =
    saved.status === "ready"
      ? count === 0
        ? "None saved yet."
        : `${count} saved on this device`
      : saved.status === "loading"
        ? "Checking…"
        : consent
          ? "Saved sessions couldn't be read in this browser."
          : "None saved. Saving is off.";

  return (
    <div>
      {!setupComplete && (
        <p className="mb-6 text-text-muted">
          You haven&apos;t finished setup yet.{" "}
          <Button variant="ghost" onClick={() => navigate("/start")}>
            Continue setup
          </Button>
        </p>
      )}

      <Ledger>
        <LedgerRow
          label="Goal"
          meta={
            <Button variant="ghost" onClick={() => setEditingGoal((v) => !v)} aria-expanded={editingGoal} aria-controls="profile-goal-picker">
              {editingGoal ? "Done" : "Change"}
            </Button>
          }
        >
          {goal ? <LedgerValue>{GOAL_LABELS[goal]}</LedgerValue> : <span className="text-text-muted">Not chosen yet.</span>}
        </LedgerRow>

        {editingGoal && (
          <div id="profile-goal-picker" className="border-b border-border py-4">
            <p id="profile-goal-label" className="sr-only">
              Primary coaching goal
            </p>
            <GoalPicker
              name="profile-goal"
              value={goal}
              labelledBy="profile-goal-label"
              onChange={(g) => {
                setPrimaryGoal(g);
                setSessionGoal(g);
              }}
            />
          </div>
        )}

        <LedgerRow
          label="Baseline"
          meta={
            <Button variant="ghost" onClick={() => navigate("/calibrate")}>
              {isCalibrated ? "Recalibrate" : "Calibrate"}
            </Button>
          }
        >
          {isCalibrated ? (
            <LedgerValue>Calibrated</LedgerValue>
          ) : (
            <span className="text-text-muted">Not calibrated yet.</span>
          )}
        </LedgerRow>

        <LedgerRow label="Sessions">
          <span className={count > 0 ? "" : "text-text-muted"}>{sessionsText}</span>
          {count > 0 && (
            <>
              {" "}
              <Link to="/reports" className="font-serif italic underline decoration-1 underline-offset-4 hover:text-accent">
                View reports
              </Link>
            </>
          )}
        </LedgerRow>

        <LedgerRow
          label="Saving"
          meta={
            <Button variant="ghost" onClick={() => onOpenTab("data")}>
              Manage
            </Button>
          }
        >
          {consent ? "On: session summaries are kept on this device." : <span className="text-text-muted">Off: nothing is kept after a session.</span>}
        </LedgerRow>
      </Ledger>

      <p className="mt-6 text-[15px] text-text-muted">
        Cue frequency, theme, and motion are under{" "}
        <Button variant="ghost" onClick={() => onOpenTab("settings")}>
          Settings
        </Button>
        .
      </p>
    </div>
  );
}
