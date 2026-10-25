/**
 * Local device profile (PRD §5: no account in the prototype).
 * Owner: App-shell / State team.
 *
 * Holds first-run progress, the consent to save session metrics, the person's
 * primary goal, and UI preferences. Persisted to localStorage because these are
 * preferences, not session data — consented session metrics and baselines go
 * through lib/storage (IndexedDB) once it lands. Never stores video or frames.
 */

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { CoachingGoal, CommunicationProfile } from "@/types";
import type { ThemePreference } from "@/styles/theme";

export interface ProfileSettings {
  muteCues: boolean;
  /** Keep adjusting the camera baseline and cue timing from sessions after the first baseline. */
  keepLearning: boolean;
  cueFrequency: "standard" | "fewer";
  showSignalViz: boolean;
  theme: ThemePreference;
  reducedMotion: "system" | "on";
}

interface ProfileState {
  setupComplete: boolean;
  /** Opt-in, off by default (PRD §4.4 "ask permission before saving session metrics"). */
  consentSaveMetrics: boolean;
  primaryGoal: CoachingGoal | null;
  /** Desired communication style (Stage 1). Text only; separate from the behavioral baseline. */
  communicationProfile: CommunicationProfile | null;
  settings: ProfileSettings;
  setSetupComplete: (v: boolean) => void;
  setConsentSaveMetrics: (v: boolean) => void;
  setPrimaryGoal: (goal: CoachingGoal) => void;
  setCommunicationProfile: (profile: CommunicationProfile | null) => void;
  updateSettings: (patch: Partial<ProfileSettings>) => void;
  resetProfile: () => void;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  muteCues: false,
  keepLearning: true,
  cueFrequency: "standard",
  showSignalViz: false,
  theme: "light",
  reducedMotion: "system",
};

const INITIAL = {
  setupComplete: false,
  consentSaveMetrics: false,
  primaryGoal: null,
  communicationProfile: null,
  settings: DEFAULT_SETTINGS,
};

export const PROFILE_STORAGE_KEY = "cue-profile";

/** localStorage can be missing or throw (private mode, blocked storage); the app must still run. */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* preferences just won't persist */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setSetupComplete: (setupComplete) => set({ setupComplete }),
      setConsentSaveMetrics: (consentSaveMetrics) => set({ consentSaveMetrics }),
      setPrimaryGoal: (primaryGoal) => set({ primaryGoal }),
      setCommunicationProfile: (communicationProfile) => set({ communicationProfile }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetProfile: () => set(INITIAL),
    }),
    {
      name: PROFILE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ setupComplete, consentSaveMetrics, primaryGoal, communicationProfile, settings }) => ({
        setupComplete,
        consentSaveMetrics,
        primaryGoal,
        communicationProfile,
        settings,
      }),
      // Settings added later get their defaults instead of `undefined`.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProfileState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
    },
  ),
);
