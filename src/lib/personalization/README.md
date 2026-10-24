# `personalization` module ⭐ core differentiator

**Owner:** Personalization team · **Depends on:** `signals`, `config/coaching`

Learns the user's baseline and decides what counts as a *relevant* deviation. PRD §7.

## Public surface (`index.ts`)
- `createPersonalizationEngine()` → `calibrate / loadBaseline / assess / updateDuringStablePeriod / getBaseline`.

## Contract
- Transparent rules only — **no** trained ML model (PRD §7).
- Pause baseline updates during a suspected deviation so unusual behavior doesn't
  silently become the new normal (PRD §7.2).
- Acceptance: two profiles with different baselines produce **different** decisions
  for the same input (PRD §17.10). This is the demo's whole point.

## Done when
- Calibration yields a stored baseline; `assess()` returns a z-score deviation + relevance flag.
