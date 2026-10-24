# `Reports` — session history (`/reports`)

**Owner:** UI / Reports · **Depends on:** `state/savedData`, `state/profileStore`, shared components

The register of saved sessions (`docs/FRONTEND_GUIDE.md` §3.4), newest first. Each row's date links
to `/report/:sessionId`.

## Rules
- Counts only (length, events, cues). No score, no trend line, no streaks.
- Empty states are honest: "saving is off" links to Profile → Data & privacy; "nothing filed yet"
  offers a session.
- Goal and event columns hide below the `sm` breakpoint; the date, length, and cues stay.

## Data
`useSavedSessions()` reads `CueStorage.listSessions()` (IndexedDB) and maps each session through
`lib/reports`' `toSessionSummary`.
