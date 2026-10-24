# `Profile` — local device profile (`/profile`)

**Owner:** UI / Profile · **Depends on:** `state/profileStore`, `state/savedData`, shared components

Three tabs from `docs/FRONTEND_GUIDE.md` §3.3, selected by `?tab=` (`settings`, `data`; none = overview):

- **Overview:** goal (change inline), baseline (calibrate/recalibrate), saved sessions, saving status.
- **Settings:** show cues, cue frequency, signal sketch, theme, reduce motion.
- **Data & privacy:** what is and isn't kept, the saving consent, delete history / reset baseline /
  reset everything (each confirmed in a dialog).

## Rules
- There is no account. Never word anything as if there were one.
- Settings store overrides only; thresholds and timing come from `src/config/coaching.ts`.
- No fabricated counts: sessions come from `lib/storage` via `state/savedData`; if it can't be read,
  the page says so.

## Done when
- Live Coaching reads `muteCues`, `cueFrequency`, and `showSignalViz`.
