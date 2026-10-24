import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Dashboard } from "./screens/Dashboard";
import { Calibration } from "./screens/Calibration";
import { LiveCoaching } from "./screens/LiveCoaching";
import { PostSession } from "./screens/PostSession";

/**
 * App shell + routing. Owner: UI / App-shell team.
 * The four PRD screens (§6) are mounted here. Each screen owns its own folder.
 */
export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-text-primary">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calibrate" element={<Calibration />} />
          <Route path="/session" element={<LiveCoaching />} />
          <Route path="/report/:sessionId" element={<PostSession />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
