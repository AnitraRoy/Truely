# `Setup` — first-time setup (`/start`)

**Owner:** UI / Onboarding · **Depends on:** `state/profileStore`, `state/sessionStore`, shared components

Five-step wizard from `docs/FRONTEND_GUIDE.md` §3.2: Welcome → Goal → Saving (consent) →
Camera → Baseline.

## Rules
- The camera is never requested before the Camera step.
- Answers persist as they are given (goal and consent go to `profileStore`).
- Saving metrics is opt-in, off by default (PRD §4.4).
- The webcam preview stays mounted across Camera and Baseline so the stream survives.
- Focus moves to each step's heading on change.

## Done when
- Baseline completion comes from the personalization engine (`minCalibrationSamples`)
  instead of the manual "My baseline is ready" button.
- `setupComplete` routes first-time visitors here from the landing page.
