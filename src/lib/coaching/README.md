# `coaching` module

**Owner:** Personalization team (cue rendering shared with UI) · **Depends on:** `personalization`, `config/coaching`

The cue state machine that decides *when* to speak and *what* to say. PRD §7.3–§7.4, §8.

## Public surface (`index.ts`)
- `createCoachingEngine({ goal?, config?, adaptation?, clock?, idFactory? })`
  → `tick / getActiveCue / dismissActiveCue / pause / resume / recordFeedback / getEvents / setGoal / getState / endSession / getAdaptationState / subscribe`
- `selectCueText(goal, signal)`

## Wiring (per frame)
```ts
const assessment = personalization.assess(obs);
personalization.updateDuringStablePeriod(obs);
const state = coaching.tick({ assessment, trackingConfidence: frame.trackingConfidence, now });
const cue = coaching.getActiveCue();   // render when non-null (state === "CUE_VISIBLE")
```
- `state === "TRACKING_UNAVAILABLE"` → show `TRACKING_LIMITED_MESSAGE` (status, not a coaching cue).
- **Events change after they're emitted** (feedback, response measurement, dismissed). Use `subscribe()` to stay live,
  and at session end replace `session.events` with `coaching.endSession()`.
- Persist `coaching.getAdaptationState()` so "too distracting" answers carry into the next session
  (pass it back as `options.adaptation`).

## State machine
`OBSERVING → CANDIDATE_DEVIATION → CUE_VISIBLE → COOLDOWN → OBSERVING`; `PAUSED` and `TRACKING_UNAVAILABLE` interrupt any state.
No timers: time only moves through `tick({ now })` (deterministic, testable).

## The 10 rules (PRD §8) — where each lives
1 confidence gate (`tick`, with a short grace for dropped frames) · 2 persistence window + relevant-fraction ·
3 paused short-circuit · 4 `activeCue` guard · 5 cooldown (× feedback × repeat back-off) ·
6 `isGoalSignal` · 7/9 cue library has no personality/eye-contact language · 8 responses are `observedChange` only, never "success" ·
10 nothing here touches the network.

## Beyond the PRD minimum
- A signal that never returns to normal gets at most `maxUnrecoveredCues` cues, with growing cooldowns.
- `response` on each event: pre/post mean deviation + `closer_to_baseline | no_clear_change | further_from_baseline | insufficient_data`.

## Done when ✅
- A *sustained* deviation produces one private cue; cooldown blocks repeats; feedback is recorded. (Covered in `__tests__`.)
