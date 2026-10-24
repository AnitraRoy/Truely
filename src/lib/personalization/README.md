# `personalization` module ⭐ core differentiator

**Owner:** Personalization team · **Depends on:** `config/coaching`

Learns the user's baseline and decides what counts as a *deviation for them*. PRD §7.

## Public surface (`index.ts`)
- `createPersonalizationEngine({ config? })` → `calibrate / loadBaseline / assess / updateDuringStablePeriod / getBaseline / getBaselines / clearBaseline`
- `createCalibrationCollector(signal)` → `add(obs) / getProgress() / getObservations()` — drives the calibration progress bar.
- `CalibrationError` — thrown by `calibrate` when there aren't enough reliable samples (show a retry + lighting tips).

## How it works (all transparent math, no ML)
1. **Calibrate:** Welford mean + variance over valid, confident observations.
2. **Assess:** EMA-smooth the value → `|value − mean| / max(std, floor)` = z-score. `isRelevantDeviation` = z ≥ `deviationZThreshold`.
   The std floor (`minStdDev`, per signal) stops a very steady calibration from over-triggering.
3. **Update:** `updateDuringStablePeriod` drifts the baseline with a *time-based* EMA (frame-rate independent),
   but never for observations ≥ `baselineStableZ` and not for `baselineUpdateHoldMs` afterwards — so a sustained
   unusual behavior can't silently become the new normal (PRD §7.2).

## Notes
- `assess` does not know the goal; goal filtering happens in `coaching` (rule 6).
- Persist `getBaselines()` (with consent); restore with `loadBaseline()`. Reset = `clearBaseline()`.
- Smoothing here is time-constant based. If `lib/signals` also smooths, keep one of them light.

## Done when ✅
- Calibration yields a stored baseline; `assess()` returns a z-score deviation + relevance flag.
- Two profiles give different decisions for the same input (see `__tests__`).
