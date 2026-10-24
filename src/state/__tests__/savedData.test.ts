// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetBaseline, resetEverything } from "../savedData";
import { useProfileStore } from "../profileStore";
import { useSessionStore } from "../sessionStore";

// lib/storage is still a stub that throws; these actions must degrade, not crash.
describe("savedData actions", () => {
  beforeEach(() => {
    useProfileStore.getState().resetProfile();
    useSessionStore.getState().reset();
  });

  it("reset baseline clears calibration and keeps the goal", async () => {
    useSessionStore.getState().setGoal("camera_engagement");
    useSessionStore.getState().setCalibrated(true);
    await resetBaseline();
    expect(useSessionStore.getState().isCalibrated).toBe(false);
    expect(useSessionStore.getState().goal).toBe("camera_engagement");
  });

  it("reset everything returns the profile to first-run even without storage", async () => {
    useProfileStore.getState().setSetupComplete(true);
    useProfileStore.getState().setConsentSaveMetrics(true);
    useProfileStore.getState().updateSettings({ theme: "dark" });
    useSessionStore.getState().setCalibrated(true);
    await resetEverything();
    const p = useProfileStore.getState();
    expect(p.setupComplete).toBe(false);
    expect(p.consentSaveMetrics).toBe(false);
    expect(p.settings.theme).toBe("light");
    expect(useSessionStore.getState().isCalibrated).toBe(false);
  });
});
