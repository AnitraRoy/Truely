# Screen A — Dashboard

**Owner:** Screen A team · **Route:** `/home` · PRD §6 Screen A

The returning person's journal: start a session and see where things stand. PRD Screen A is split
across two routes. The public introduction (logo, headline "Show up as yourself. A little better every
time.", privacy explanation) is the Landing page at `/`. This screen keeps the working parts.

## Must include
- Primary "Start a session" ("Continue setup" until setup is finished).
- Selected goal and calibration status.
- Recent sessions (latest three, linking to their reports) when data exists, plus "All reports";
  "View past sessions" is also the Reports link in the site nav.
- Honest empty states: say why nothing is listed (saving off vs. nothing filed yet).
- **No fabricated progress, scores, or history.**

## Reads
`useSavedSessions()` (wraps `storage.listSessions()`), `useSessionStore`, `useProfileStore`.
