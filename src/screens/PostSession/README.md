# Screen D — Post-Session Report

**Owner:** Screen D team · **Route:** `/report/:sessionId` · PRD §6 Screen D

Help the user understand what happened and find one actionable improvement.

## Sections
- **Summary**: duration, goal, event count, cue count, dismissed count, measured-change note.
  **No overall communication-quality score.**
- **Timeline**: horizontal, timestamped — deviations, cues, post-cue window, tracking gaps.
  Selecting an event shows timestamp, signal, observed behavior, why the cue fired, what
  happened after. Show observations **without claiming causation**.
- **Insights**: up to 3, each backed by real session data.
- **Feedback**: "Was this cue helpful?" → helpful / not helpful / too distracting (stored on the event).
- **Actions**: start another, return to dashboard, view previous sessions.

## Uses
`reports.buildTimeline() / summarize() / deriveInsights()`, `storage`, `coaching.recordFeedback()`.
