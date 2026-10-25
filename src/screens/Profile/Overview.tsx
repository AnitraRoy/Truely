import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GOAL_LABELS } from "@/config/coaching";
import { FEEDBACK_CATEGORY_LABELS } from "@/config/conversation";
import { Button } from "@/components/Button";
import { GoalPicker } from "@/components/GoalPicker";
import { Pill } from "@/components/Pill";
import { SectionTitle, Sheet } from "@/components/Sheet";
import { formatDate } from "@/components/format";
import { useProfileStore } from "@/state/profileStore";
import { useSessionStore } from "@/state/sessionStore";
import { getStorage } from "@/state/savedData";
import { useHistory } from "@/state/history";
import type { BehavioralBaseline, FeedbackCategory, SignalName } from "@/types";

/**
 * 10 · Profile review: desired style beside the natural baseline, kept apart on
 * purpose (they are never merged into one score). Honest values only: the
 * baseline column lists what calibration actually measured, and "where
 * practice meets your goals" counts sessions, never a percentage or bar.
 */
const SIGNAL_LABELS: Record<SignalName, { name: string; detail: string }> = {
  head_orientation: { name: "Head orientation", detail: "Your usual angle toward the screen" },
  gaze_direction: { name: "Gaze direction", detail: "Where you usually look while talking" },
  movement_variability: { name: "Movement", detail: "How much you usually move" },
};

export function Overview({ onOpenTab }: { onOpenTab: (tab: "settings" | "data") => void }) {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.communicationProfile);
  const goal = useProfileStore((s) => s.primaryGoal);
  const setPrimaryGoal = useProfileStore((s) => s.setPrimaryGoal);
  const setupComplete = useProfileStore((s) => s.setupComplete);
  const setSessionGoal = useSessionStore((s) => s.setGoal);
  const calibrated = useSessionStore((s) => s.isCalibrated);
  const history = useHistory();
  const [editingGoal, setEditingGoal] = useState(false);
  const [baselines, setBaselines] = useState<BehavioralBaseline[] | null>(null);

  useEffect(() => {
    getStorage()
      .loadBaselines()
      .then(setBaselines)
      .catch(() => setBaselines([]));
  }, [calibrated]);

  const kept = profile?.traits.filter((t) => t.keep) ?? [];
  const practice = history.status === "ready" ? history.entries.filter((e) => !e.sample && e.hasTranscript) : [];
  const categories = [...new Set(kept.map((t) => t.category))] as FeedbackCategory[];
  const measured = new Map((baselines ?? []).map((b) => [b.signal, b]));
  const calibratedAt = baselines && baselines.length > 0 ? Math.max(...baselines.map((b) => b.updatedAt)) : null;

  return (
    <div>
      {!setupComplete && (
        <p className="mb-6 text-[14.5px] text-text-muted">
          First-time setup isn&apos;t finished: saving and camera calibration.{" "}
          <Button variant="ghost" size="sm" onClick={() => navigate("/start")}>
            Continue setup
          </Button>
        </p>
      )}

      <div className="grid items-start gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Sheet aria-labelledby="desired-title" className="px-6 py-7 md:px-8">
          <SectionTitle id="desired-title">How you want to come across</SectionTitle>
          <p className="mt-1 text-[14px] text-text-muted">Your desired style, from your communication profile.</p>
          {kept.length > 0 ? (
            <dl className="mt-5 border-t border-border">
              {kept.map((t) => (
                <div key={t.id} className="grid gap-x-6 border-b border-border py-3.5 sm:grid-cols-[150px_1fr]">
                  <dt className="font-medium text-accent">{t.name}</dt>
                  <dd>{t.description}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-5 border-t border-border pt-4 font-serif italic text-text-muted">No patterns chosen yet.</p>
          )}
          <div className="mt-6">
            <Button onClick={() => navigate("/profile/style")}>{kept.length > 0 ? "Edit desired style" : "Build your profile"}</Button>
          </div>
        </Sheet>

        <Sheet aria-labelledby="baseline-title" className="px-6 py-7 md:px-8">
          <SectionTitle id="baseline-title">What calibration observes</SectionTitle>
          <p className="mt-1 text-[14px] text-text-muted">
            Your natural baseline, measured on camera.{" "}
            {calibratedAt ? `Last calibrated ${formatDate(calibratedAt)}.` : calibrated ? "Calibrated this visit." : ""}
          </p>
          <ul className="mt-5 border-t border-border">
            {(Object.keys(SIGNAL_LABELS) as SignalName[]).map((s) => {
              const b = measured.get(s);
              return (
                <li key={s} className="flex items-start justify-between gap-4 border-b border-border py-3.5">
                  <span>
                    <span className="block font-medium">{SIGNAL_LABELS[s].name}</span>
                    <span className="text-[13.5px] text-text-muted">{SIGNAL_LABELS[s].detail}</span>
                  </span>
                  {b ? <Pill tone="positive">measured</Pill> : <Pill tone="muted">{baselines === null ? "checking" : "not measured"}</Pill>}
                </li>
              );
            })}
            <li className="border-b border-border py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="block font-medium">Camera goal</span>
                  <span className="text-[13.5px] text-text-muted">{goal ? GOAL_LABELS[goal] : "Not chosen yet"}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditingGoal((v) => !v)} aria-expanded={editingGoal} aria-controls="profile-goal-picker">
                  {editingGoal ? "Done" : "Change"}
                </Button>
              </div>
              {editingGoal && (
                <div id="profile-goal-picker" className="mt-3">
                  <p id="profile-goal-label" className="sr-only">
                    Camera coaching goal
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
            </li>
          </ul>
          <p className="mt-4 text-[13.5px] text-text-muted">Only measured when you turn the camera on. Video is never saved or uploaded.</p>
          <div className="mt-5">
            <Button variant="secondary" onClick={() => navigate("/calibrate")}>
              {calibrated ? "Recalibrate" : "Calibrate"}
            </Button>
          </div>
        </Sheet>
      </div>

      <section aria-labelledby="meets-title" className="mt-12">
        <SectionTitle id="meets-title">Where practice meets your goals</SectionTitle>
        <p className="mt-1 text-[14px] text-text-muted">How often each aspect you chose came up in feedback. A count, not a grade.</p>
        {categories.length === 0 || practice.length === 0 ? (
          <p className="mt-4 border-t border-border pt-4 font-serif italic text-text-muted">
            {categories.length === 0 ? "Choose some patterns first." : "Nothing to compare yet. This fills in after your first practice session."}
          </p>
        ) : (
          <dl className="mt-4 grid border-t border-border sm:grid-cols-3">
            {categories.map((c) => {
              const n = practice.filter((e) => e.categories.includes(c)).length;
              return (
                <div key={c} className="border-b border-border py-4 sm:pr-6">
                  <dt className="font-medium">{FEEDBACK_CATEGORY_LABELS[c]}</dt>
                  <dd className="mt-0.5 text-[14.5px] text-text-muted">
                    Came up in <span className="tabular-nums text-text-primary">{n}</span> of {practice.length} practice session{practice.length === 1 ? "" : "s"}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        {practice.length > 0 && (
          <Link to="/reports" className="mt-3 inline-block text-[14px] underline underline-offset-4 hover:text-accent">
            Open session history
          </Link>
        )}
      </section>

      <p className="mt-10 text-[14.5px] text-text-muted">
        Cue frequency, theme and motion are under{" "}
        <Button variant="ghost" size="sm" onClick={() => onOpenTab("settings")}>
          Settings
        </Button>
        . What&apos;s kept, and deleting it, is under{" "}
        <Button variant="ghost" size="sm" onClick={() => onOpenTab("data")}>
          Data &amp; privacy
        </Button>
        .
      </p>
    </div>
  );
}
