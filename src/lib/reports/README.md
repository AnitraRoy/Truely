# `reports` module

**Owner:** Data team · **Depends on:** `sessions`

Turns a finished `Session` into timeline, summary, and insights. PRD §6 Screen D, §9.

## Public surface (`index.ts`)
- `createReportBuilder()` → `summarize / buildTimeline / deriveInsights`.

## Contract
- **No fabricated data**: no overall "communication-quality score", no invented insights (PRD §6, §12).
- Show observations without claiming causation — a cue is not "successful" just because
  the next measurement changed (PRD §6).
- At most three insights, each backed by real session data.

## Done when
- Timeline uses actual event timestamps; selecting an event reveals its supporting observations.
