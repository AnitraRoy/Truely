# `coaching` module

**Owner:** Personalization team (cue rendering shared with UI) · **Depends on:** `personalization`, `config/coaching`

The cue state machine that decides *when* to speak and *what* to say. PRD §7.3–§7.4, §8.

## Public surface (`index.ts`)
- `createCoachingEngine()` → `tick / getActiveCue / dismissActiveCue / pause / resume / recordFeedback / getEvents / setGoal`.

## State machine (PRD §7.4)
`OBSERVING → CANDIDATE_DEVIATION → COOLDOWN → CUE_VISIBLE → PAUSED → TRACKING_UNAVAILABLE`

## The 10 rules (PRD §8) — all must hold
No cue without confidence · not for a momentary blip · not while paused · no duplicate while one
is visible · respect cooldown · only goal-relevant signals · no personality/honesty inference ·
no improvement claim unless measured · never require constant eye contact · never transmit frames.

## Done when
- A *sustained* deviation produces one private cue; cooldown blocks repeats; feedback is recorded.
