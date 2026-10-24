# `sessions` module

**Owner:** Data team · **Depends on:** `src/types`

Tracks a live session's lifecycle and accumulates events. PRD §9 (sessions).

## Public surface (`index.ts`)
- `createSessionManager()` → `start / addEvent / end / getCurrent`.

## Contract
- Uses a **bounded in-memory buffer** for real-time data; persist only aggregates (PRD §10).
- Hands a finished `Session` to `reports` and `storage`.

## Done when
- A completed session carries real timestamps and counts, ready for the report screen.
