// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createIndexedDbStorage, createMemoryStorage, type CueStorage } from "../index";
import type { BehavioralBaseline, Session } from "@/types";

const session = (id: string, startedAt: number): Session => ({
  id, startedAt, goal: "general_awareness", status: "ended", eventCount: 0, cueCount: 0, events: [],
});
const baseline: BehavioralBaseline = { signal: "head_orientation", sampleCount: 300, mean: 8, variance: 4, calibrationDurationMs: 45000, updatedAt: 1 };

const impls: [string, () => CueStorage][] = [
  ["memory", () => createMemoryStorage()],
  ["indexeddb", () => createIndexedDbStorage(`cue-test-${Math.random()}`)],
];

describe.each(impls)("storage (%s)", (_name, make) => {
  it("round-trips and lists sessions newest first; deletes one", async () => {
    const s = make();
    await s.saveSession(session("a", 100));
    await s.saveSession(session("b", 300));
    await s.saveSession(session("c", 200));
    expect((await s.listSessions()).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect((await s.getSession("c"))?.startedAt).toBe(200);
    await s.deleteSession("c");
    expect(await s.getSession("c")).toBeNull();
  });

  it("stores baselines, adaptation, consent; consent defaults to false", async () => {
    const s = make();
    expect(await s.getConsent()).toBe(false);
    await s.setConsent(true);
    await s.saveBaselines([baseline]);
    await s.saveAdaptation({ head_orientation: { helpful: 0, notHelpful: 1, tooDistracting: 2 } });
    expect(await s.getConsent()).toBe(true);
    expect(await s.loadBaselines()).toEqual([baseline]);
    expect((await s.loadAdaptation()).head_orientation?.tooDistracting).toBe(2);
  });

  it("clearBaselines leaves sessions; deleteAllData removes everything incl. consent", async () => {
    const s = make();
    await s.setConsent(true);
    await s.saveSession(session("a", 1));
    await s.saveBaselines([baseline]);
    await s.clearBaselines();
    expect(await s.loadBaselines()).toEqual([]);
    expect(await s.listSessions()).toHaveLength(1);
    await s.deleteAllData();
    expect(await s.listSessions()).toEqual([]);
    expect(await s.getConsent()).toBe(false);
    expect(await s.loadAdaptation()).toEqual({});
  });
});
