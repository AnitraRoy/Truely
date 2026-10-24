// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage, type CueStorage } from "@/lib/storage";
import type { BehavioralBaseline, Session } from "@/types";
import { deleteSessionHistory, resetBaseline, resetEverything, setStorageForTests, syncSaveConsent } from "../savedData";
import { useProfileStore } from "../profileStore";
import { useSessionStore } from "../sessionStore";

const baseline: BehavioralBaseline = {
  signal: "head_orientation",
  sampleCount: 200,
  mean: 0,
  variance: 4,
  calibrationDurationMs: 45_000,
  updatedAt: 1,
};

const session = (id: string, startedAt: number): Session => ({
  id,
  startedAt,
  endedAt: startedAt + 60_000,
  goal: "head_movement",
  status: "ended",
  eventCount: 0,
  cueCount: 0,
  events: [],
});

describe("savedData actions (real storage engine, in memory)", () => {
  let storage: CueStorage;

  beforeEach(async () => {
    storage = createMemoryStorage();
    setStorageForTests(storage);
    useProfileStore.getState().resetProfile();
    useSessionStore.getState().reset();
    await storage.setConsent(true);
    await storage.saveBaselines([baseline]);
    await storage.saveSession(session("a", 1_000));
    await storage.saveSession(session("b", 2_000));
  });

  it("delete history removes sessions but keeps the baseline", async () => {
    await deleteSessionHistory();
    expect(await storage.listSessions()).toEqual([]);
    expect(await storage.loadBaselines()).toHaveLength(1);
  });

  it("reset baseline clears saved baselines and calibration, keeps sessions and goal", async () => {
    useSessionStore.getState().setGoal("camera_engagement");
    useSessionStore.getState().setCalibrated(true);
    await resetBaseline();
    expect(await storage.loadBaselines()).toEqual([]);
    expect(await storage.listSessions()).toHaveLength(2);
    expect(useSessionStore.getState().isCalibrated).toBe(false);
    expect(useSessionStore.getState().goal).toBe("camera_engagement");
  });

  it("reset everything wipes storage (including consent) and returns the profile to first-run", async () => {
    useProfileStore.getState().setSetupComplete(true);
    useProfileStore.getState().setConsentSaveMetrics(true);
    useProfileStore.getState().updateSettings({ theme: "dark" });
    await resetEverything();
    expect(await storage.listSessions()).toEqual([]);
    expect(await storage.loadBaselines()).toEqual([]);
    expect(await storage.getConsent()).toBe(false);
    const p = useProfileStore.getState();
    expect(p.setupComplete).toBe(false);
    expect(p.consentSaveMetrics).toBe(false);
    expect(p.settings.theme).toBe("light");
  });

  it("mirrors the profile's saving consent into storage for the engine", async () => {
    await syncSaveConsent(false);
    expect(await storage.getConsent()).toBe(false);
    await syncSaveConsent(true);
    expect(await storage.getConsent()).toBe(true);
  });
});
