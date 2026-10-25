// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEMO_PROFILES, runDemoComparison } from "../profiles";

describe("two-profile demo (simulated input, real engines)", () => {
  const [a, b] = runDemoComparison();

  it("is labeled simulated", () => {
    expect(a.simulated && b.simulated).toBe(true);
    expect(DEMO_PROFILES.every((p) => p.simulated)).toBe(true);
  });

  it("the same input gives different decisions for different baselines", () => {
    expect(a.cues).toHaveLength(1);
    expect(b.cues).toHaveLength(1);
    // A is cued for the sustained HIGH offset (20–28 s)…
    expect(a.cues[0].timestamp).toBeGreaterThan(20_000);
    expect(a.cues[0].timestamp).toBeLessThan(28_000);
    // …B is cued for the sustained LOW offset (40 s+), and NOT for the high one that's normal for B.
    expect(b.cues[0].timestamp).toBeGreaterThan(40_000);
  });

  it("neither profile is cued for the 1-second blip", () => {
    for (const r of [a, b]) expect(r.cues.every((c) => c.timestamp > 12_000)).toBe(true);
  });

  it("is deterministic", () => {
    const again = runDemoComparison();
    expect(again[0].cues[0].timestamp).toBe(a.cues[0].timestamp);
  });
});
