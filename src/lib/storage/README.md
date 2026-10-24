# `storage` module

**Owner:** Data team · **Depends on:** IndexedDB, `src/types`

Local persistence for baselines and session history. PRD §9 (storage), §12 (privacy).

## Public surface (`index.ts`)
- `createStorageAdapter()` → `saveBaseline / loadBaselines / saveSession / listSessions / getSession / deleteSession / resetAll`.

## Contract
- **Never** persist raw webcam footage (PRD §4.4, §12).
- Only store what's documented; ask consent before saving session metrics (PRD §4.4).
- User can delete history and reset the baseline (PRD §12).

## Done when
- Sessions + baselines round-trip through IndexedDB; delete and reset work.
