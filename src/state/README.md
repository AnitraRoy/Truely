# `state` — session state & engine wiring

**Owner:** App-shell / State team · **Depends on:** `zustand`, all `lib/*` engines

Holds UI-facing session state and wires the `lib/*` engines into React.
Keep the heavy logic in `lib/*`; this layer stays thin (PRD §9, §13).

## Surface
- `useSessionStore` — goal, status, calibration flag.

A future `useLiveSession` hook here will own the per-frame loop:
`camera → vision → signals → personalization → coaching → sessions`.
