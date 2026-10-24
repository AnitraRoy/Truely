// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, PROFILE_STORAGE_KEY, useProfileStore } from "../profileStore";

// jsdom isn't installed; a Map-backed localStorage is all the store needs.
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe("profileStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.getState().resetProfile();
  });

  it("starts with saving off, light theme, and setup not done (PRD §4.4)", () => {
    const s = useProfileStore.getState();
    expect(s.consentSaveMetrics).toBe(false);
    expect(s.setupComplete).toBe(false);
    expect(s.settings.theme).toBe("light");
  });

  it("persists answers to localStorage as they are given", () => {
    useProfileStore.getState().setPrimaryGoal("head_movement");
    useProfileStore.getState().setConsentSaveMetrics(true);
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)!).state;
    expect(saved.primaryGoal).toBe("head_movement");
    expect(saved.consentSaveMetrics).toBe(true);
    expect(saved.setSetupComplete).toBeUndefined(); // actions are not persisted
  });

  it("merges a partial settings patch without dropping other settings", () => {
    useProfileStore.getState().updateSettings({ theme: "dark" });
    expect(useProfileStore.getState().settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
  });

  it("fills settings added later with defaults when rehydrating old data", async () => {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ state: { setupComplete: true, settings: { theme: "dark" } }, version: 1 }),
    );
    await useProfileStore.persist.rehydrate();
    const s = useProfileStore.getState();
    expect(s.setupComplete).toBe(true);
    expect(s.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
  });
});
