# `sessions` (+ `storage`, `reports`, `signals`, `vision/types`, `demo`)

**Owner:** Integration (Person 4) · PRD §5, §9, §12

## One-time setup
```bash
npm i idb-keyval
npm i -D vitest fake-indexeddb
npx vitest run          # 83 tests: engines + this layer
```
`tsconfig.json` must map `"@/*": ["./src/*"]` (create-next-app does this by default).

## App wiring (once, in a client component near the root)
```tsx
"use client";
import { useMemo, useEffect } from "react";
import { createSessionController } from "@/lib/sessions";
import { SessionProvider } from "@/lib/sessions/react";
import { createDefaultStorage } from "@/lib/storage";
import { createFaceTrackerSource } from "@/lib/vision/faceTracker";               // Person 2's MediaPipe VisionSource

export function Providers({ children }: { children: React.ReactNode }) {
  const controller = useMemo(
    () => createSessionController({ vision: createFaceTrackerSource(), storage: createDefaultStorage() }),
    [],
  );
  useEffect(() => { void controller.init(); }, [controller]);
  return <SessionProvider controller={controller}>{children}</SessionProvider>;
}
```
(`SessionProvider`, `useSession`, `useSessionController` come from `@/lib/sessions/react`.)

Until Person 2 ships, swap in the simulated source — and label it in the UI:
```ts
import { createScriptedVisionSource, wobble } from "@/lib/vision/scriptedSource";
const vision = createScriptedVisionSource({ mode: "realtime", scenario: (t) => ({ yaw: 8 + 2 * wobble(t) }) });
```

## For Person 1 (UI) — the only API you need
```tsx
const s = useSession();            // SessionSnapshot — re-renders on change
const c = useSessionController();  // methods
```
| Screen | Read | Call |
|---|---|---|
| Dashboard | `s.hasBaseline`, `s.baselines`, `s.saveConsent` | `c.setGoal`, `c.setSaveConsent`, `deleteAllData()` |
| Calibration | `s.calibration.fraction`, `s.trackingMessage`, `s.error`, `s.phase === "calibrated"` | `c.startCalibration()`, `c.cancelCalibration()`, `c.recalibrate()` |
| Live | `s.status`, `s.cueState`, `s.activeCue`, `s.elapsedMs`, `s.liveDeviation`, `s.paused`, `s.cuesMuted`, `s.trackingMessage` | `c.startSession()`, `pause/resume/dismissCue/setCuesMuted`, `c.end()` |
| Preview | `s.cameraActive` | `video.srcObject = c.getVisionStream()` |
| Report | — | `buildReport(session)`, `buildEventDetail(session, id)`, `c.submitFeedback(id, fb)` |

* Render a cue only from `s.activeCue` (already null when paused/muted).
* `s.trackingMessage` is a *status* string, not a coaching cue — show it as a quiet banner.
* After `end()` resolves (or `s.phase === "ended"`), `s.session` is the full session for the report.
* History: `storage.listSessions()` → `toSessionSummary(session)` for list rows; open one with `buildReport(session)`.
* Feedback on a past session: `recordFeedbackForSavedSession(storage, sessionId, eventId, fb)`.

## For Person 2 (CV) — implement `VisionSource` (`vision/types.ts`)
* `timestamp` on every `VisionFrame` = **`Date.now()`**.
* `headPose.yaw/pitch` in degrees **relative to the camera** (0,0 = facing it).
* `start()` rejects with the browser's DOMException (`NotAllowedError`, `NotFoundError`, …) or an Error named `VisionInitError`.
* `stop()` stops every `MediaStream` track and is idempotent.
* Provide `getStream()` for the preview. Set `trackingConfidence` 0 / `faceDetected` false when no usable face.
* Units for signals are documented in `signals/index.ts`; if you change them, retune `minStdDev` in `config/coaching.ts`.

## Data flow & guarantees
`VisionSource → signals → personalization.assess → coaching.tick → recorder → Session → reports`
* Frames are never stored. Storage holds derived data only, and **only after `setSaveConsent(true)`**.
* No face ⇒ no observation ⇒ engine ticked with `assessment: null` ⇒ tracking-gap segment, never a cue.
* Timeline/series/insights come from recorded segments & measurements; nothing is generated without data.
* `end()` stops the camera first, then finalizes and saves.

## Demo (PRD §16 scene 5)
`runDemoComparison()` (`lib/demo/profiles.ts`) runs one scripted, deterministic input through two profiles with different baselines
using the real engines. Label as **"Simulated input"**. Profile A is cued at the sustained high offset, Profile B at the sustained low one.
