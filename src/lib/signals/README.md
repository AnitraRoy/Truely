# `signals` module

**Owner:** Computer-Vision team (shared with Personalization) · **Depends on:** `vision`

Converts `VisionFrame`s into clean, normalized `SignalObservation`s. See PRD §7.1, §9.

## Public surface (`index.ts`)
- `createSignalExtractor()` → `SignalExtractor` with `update / reset`.

## Contract
- Smooths + normalizes so thresholds are unit-independent (PRD §7.2).
- Marks `valid: false` when tracking is too poor to trust.
- Pure/stateful math only — no React, no DOM beyond what `vision` passes.

## Done when
- Emits stable, normalized observations with confidence for each supported signal.
