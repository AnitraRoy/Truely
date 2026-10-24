import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./screens/Landing";
import { Dashboard } from "./screens/Dashboard";
import { Setup } from "./screens/Setup";
import { Profile } from "./screens/Profile";
import { Reports } from "./screens/Reports";
import { Calibration } from "./screens/Calibration";
import { LiveCoaching } from "./screens/LiveCoaching";
import { PostSession } from "./screens/PostSession";
import { useProfileStore } from "./state/profileStore";
import { useSessionStore } from "./state/sessionStore";
import { getStorage, syncSaveConsent } from "./state/savedData";
import { applyTheme } from "./styles/theme";

/**
 * App shell + routing. Owner: UI / App-shell team.
 * The PRD screens (§6) plus first-time setup are mounted here. Each screen owns
 * its own folder. See docs/FRONTEND_GUIDE.md §2 for the planned route map.
 */
export function App() {
  const theme = useProfileStore((s) => s.settings.theme);
  const reducedMotion = useProfileStore((s) => s.settings.reducedMotion);
  const primaryGoal = useProfileStore((s) => s.primaryGoal);
  const consent = useProfileStore((s) => s.consentSaveMetrics);

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    if (reducedMotion === "on") document.documentElement.setAttribute("data-motion", "reduce");
    else document.documentElement.removeAttribute("data-motion");
  }, [reducedMotion]);

  // The profile is the UI's source of truth for saving consent; storage keeps a copy for the engine.
  useEffect(() => {
    syncSaveConsent(consent).catch(() => undefined);
  }, [consent]);

  // A baseline saved in an earlier visit counts as calibrated.
  useEffect(() => {
    getStorage()
      .loadBaselines()
      .then((b) => b.length > 0 && useSessionStore.getState().setCalibrated(true))
      .catch(() => undefined);
  }, []);

  // The saved primary goal seeds each new session's goal.
  useEffect(() => {
    const session = useSessionStore.getState();
    if (primaryGoal && !session.goal) session.setGoal(primaryGoal);
  }, [primaryGoal]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-text-primary">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Dashboard />} />
          <Route path="/start" element={<Setup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/calibrate" element={<Calibration />} />
          <Route path="/session" element={<LiveCoaching />} />
          <Route path="/report/:sessionId" element={<PostSession />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
