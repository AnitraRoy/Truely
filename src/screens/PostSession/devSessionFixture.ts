import type { Session } from "@/types";

/**
 * Development-only fallback session data (see `index.tsx`). At this stage of
 * frontend work there's rarely a real saved session to open — rather than an
 * error screen that leaves the layout unreviewable, hitting `/report/:id`
 * with an unknown id in dev shows this clearly-fictional sample report
 * instead. Never used outside `import.meta.env.DEV`, and never substituted
 * for a session that's actually missing in production.
 */
const now = Date.now();
const min = (m: number) => m * 60_000;

export const DEV_SESSION_FIXTURE: Session = {
  id: "dev-fixture-session",
  startedAt: now - min(12),
  endedAt: now,
  goal: "camera_engagement",
  status: "ended",
  eventCount: 3,
  cueCount: 3,
  segments: [
    { kind: "deviation", start: now - min(12) + 40_000, end: now - min(12) + 62_000, eventId: "ev1", signal: "gaze_direction" },
    { kind: "tracking_gap", start: now - min(9), end: now - min(9) + 18_000 },
    { kind: "deviation", start: now - min(7), end: now - min(7) + 25_000, eventId: "ev2", signal: "head_orientation" },
    { kind: "paused", start: now - min(5), end: now - min(4) },
    { kind: "deviation", start: now - min(2) - 20_000, end: now - min(2), eventId: "ev3", signal: "gaze_direction" },
  ],
  events: [
    {
      id: "ev1",
      timestamp: now - min(12) + 62_000,
      signal: "gaze_direction",
      confidence: 0.92,
      deviationMagnitude: 2.4,
      cueText: "Try bringing your gaze back toward the camera.",
      responseWindowEnd: now - min(12) + 70_000,
      response: { preDeviation: 2.4, postMeanDeviation: 1.1, postSampleCount: 6, windowComplete: true, observedChange: "closer_to_baseline" },
    },
    {
      id: "ev2",
      timestamp: now - min(7) + 25_000,
      signal: "head_orientation",
      confidence: 0.88,
      deviationMagnitude: 1.9,
      cueText: "Notice your movement and find a comfortable position.",
      dismissed: true,
      responseWindowEnd: now - min(7) + 33_000,
      response: { preDeviation: 1.9, postMeanDeviation: 1.8, postSampleCount: 4, windowComplete: true, observedChange: "no_clear_change" },
    },
    {
      id: "ev3",
      timestamp: now - min(2),
      signal: "gaze_direction",
      confidence: 0.81,
      deviationMagnitude: 2.0,
      cueText: "Try bringing your gaze back toward the camera.",
      responseWindowEnd: now - min(2) + 8_000,
      response: { preDeviation: 2.0, postSampleCount: 1, windowComplete: false, observedChange: "insufficient_data" },
    },
  ],
};

/** An earlier same-goal session, so the optional "Progress" section has something to compare against. */
export const DEV_PREVIOUS_SESSION_FIXTURE: Session = {
  id: "dev-fixture-session-earlier",
  startedAt: now - min(60 * 24 * 3),
  endedAt: now - min(60 * 24 * 3) + min(9),
  goal: "camera_engagement",
  status: "ended",
  eventCount: 4,
  cueCount: 4,
  segments: [],
  events: [1, 2, 3, 4].map((i) => ({
    id: `prev-${i}`,
    timestamp: now - min(60 * 24 * 3) + min(i),
    signal: "gaze_direction",
    confidence: 0.85,
    cueText: "Try bringing your gaze back toward the camera.",
  })),
};
