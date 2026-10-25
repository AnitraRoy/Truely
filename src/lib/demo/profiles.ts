/**
 * Two-profile personalization demo (PRD §16 Scene 5, §17).
 *
 * EVERYTHING HERE IS SIMULATED. The baselines and the input stream are
 * illustrative, deterministic, and must be labeled "Simulated input" in the UI.
 * The decisions, however, come from the REAL personalization + coaching engines —
 * the same code that runs on live webcam data.
 *
 * Same input, two baselines:
 *   Profile A normally sits near 6° off-camera; Profile B near 16°.
 *   The scripted head offset sits at ~11° (normal-ish for neither), blips,
 *   then holds ~19° (unusual for A, normal for B), then ~3° (unusual for B).
 */

import { createCoachingEngine } from "@/lib/coaching";
import { createPersonalizationEngine } from "@/lib/personalization";
import { wobble } from "@/lib/vision/scriptedSource";
import type { BehavioralBaseline, CoachingEvent, CueState, SignalObservation } from "@/types";

export interface DemoProfile {
  id: string;
  label: string;
  simulated: true;
  baseline: BehavioralBaseline;
}

const base = (mean: number, std: number): BehavioralBaseline => ({
  signal: "head_orientation",
  sampleCount: 450,
  mean,
  variance: std * std,
  calibrationDurationMs: 45_000,
  updatedAt: 0,
});

export const DEMO_PROFILES: DemoProfile[] = [
  { id: "demo-a", label: "Profile A (simulated)", simulated: true, baseline: base(6, 3) },
  { id: "demo-b", label: "Profile B (simulated)", simulated: true, baseline: base(16, 4) },
];

/** Head offset in degrees at time t (ms). Deterministic. */
export function demoInput(tMs: number): number {
  const w = wobble(tMs);
  if (tMs < 10_000) return 11 + 1 * w; // steady, in between both profiles
  if (tMs < 11_000) return 24 + 1 * w; // one-second blip → no cue for anyone
  if (tMs < 20_000) return 11 + 1 * w;
  if (tMs < 28_000) return 19 + 1 * w; // sustained: unusual for A, normal for B
  if (tMs < 40_000) return 11 + 1 * w;
  return 3 + 1 * w; //                   sustained low: unusual for B, normal for A
}

export interface DemoRunResult {
  simulated: true;
  profile: DemoProfile;
  cues: CoachingEvent[];
  /** Downsampled for charts (every 500 ms). */
  trace: { t: number; value: number; z: number; state: CueState }[];
}

export function runDemoComparison(
  options: { profiles?: DemoProfile[]; durationMs?: number; stepMs?: number } = {},
): DemoRunResult[] {
  const profiles = options.profiles ?? DEMO_PROFILES;
  const durationMs = options.durationMs ?? 50_000;
  const step = options.stepMs ?? 100;

  return profiles.map((profile) => {
    const personalization = createPersonalizationEngine();
    personalization.loadBaseline(profile.baseline);
    const coaching = createCoachingEngine({ goal: "general_awareness", clock: () => 0 });
    const trace: DemoRunResult["trace"] = [];

    for (let t = step; t <= durationMs; t += step) {
      const value = demoInput(t);
      const obs: SignalObservation = {
        timestamp: t,
        signal: "head_orientation",
        value,
        confidence: 0.9,
        valid: true,
      };
      const a = personalization.assess(obs);
      personalization.updateDuringStablePeriod(obs);
      const state = coaching.tick({ assessment: a, trackingConfidence: 0.9, now: t });
      if (t % 500 === 0) trace.push({ t, value, z: a.deviationMagnitude, state });
    }
    return { simulated: true as const, profile, cues: coaching.endSession(durationMs), trace };
  });
}
