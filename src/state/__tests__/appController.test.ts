import { beforeEach, describe, expect, it } from "vitest";
import { getSessionController, resetSessionControllerForTests } from "../appController";
import { useProfileStore } from "../profileStore";
import { useSessionStore } from "../sessionStore";
import { setStorageForTests } from "../savedData";
import { createMemoryStorage } from "@/lib/storage";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("app controller wiring", () => {
  beforeEach(() => {
    resetSessionControllerForTests();
    setStorageForTests(createMemoryStorage());
    useProfileStore.getState().resetProfile();
    useSessionStore.getState().reset();
  });

  it("is created lazily and is a singleton; creating it never opens the camera", () => {
    const a = getSessionController();
    expect(getSessionController()).toBe(a);
    expect(a.getSnapshot().cameraActive).toBe(false);
    expect(a.getSnapshot().phase).toBe("idle");
  });

  it("follows the profile's consent toggle after startup (not just at init) and writes it to storage", async () => {
    const storage = createMemoryStorage();
    setStorageForTests(storage);
    const c = getSessionController();
    await tick();
    expect(c.getSnapshot().saveConsent).toBe(false);

    useProfileStore.getState().setConsentSaveMetrics(true);
    await tick();
    expect(c.getSnapshot().saveConsent).toBe(true);
    expect(await storage.getConsent()).toBe(true);

    useProfileStore.getState().setConsentSaveMetrics(false);
    await tick();
    expect(c.getSnapshot().saveConsent).toBe(false);
    expect(await storage.getConsent()).toBe(false);
  });

  it("follows the mute setting and the chosen goal", async () => {
    const c = getSessionController();
    await tick();
    useProfileStore.getState().updateSettings({ muteCues: true });
    useSessionStore.getState().setGoal("head_movement");
    await tick();
    expect(c.getSnapshot().cuesMuted).toBe(true);
    expect(c.getSnapshot().goal).toBe("head_movement");
  });
});
