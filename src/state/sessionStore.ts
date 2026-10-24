/**
 * Global session state (PRD §9 state management).
 * Owner: App-shell / State team.
 *
 * This is the thin glue binding the lib/* engines to React. Keep heavy logic
 * in the lib modules — this store only holds UI-facing state + wires events.
 */

import { create } from "zustand";
import type { CoachingGoal, SessionStatus } from "@/types";

interface SessionState {
  goal: CoachingGoal | null;
  status: SessionStatus;
  isCalibrated: boolean;
  setGoal: (goal: CoachingGoal) => void;
  setStatus: (status: SessionStatus) => void;
  setCalibrated: (v: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  goal: null,
  status: "ready",
  isCalibrated: false,
  setGoal: (goal) => set({ goal }),
  setStatus: (status) => set({ status }),
  setCalibrated: (isCalibrated) => set({ isCalibrated }),
  reset: () => set({ goal: null, status: "ready", isCalibrated: false }),
}));
