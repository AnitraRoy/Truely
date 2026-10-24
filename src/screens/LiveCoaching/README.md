# Screen C — Live Coaching ⭐ most important

**Owner:** Screen C team · **Route:** `/session` · PRD §6 Screen C

Minimal, unobtrusive live session. Real-time tracking must work before any AI summary.

## Layout
Central webcam preview · session-status indicator · minimal live cue indicator ·
optional signal viz · timer · clear end-session button. No dashboards/charts/scores.

## States (text + shape, not color alone)
calibrating · ready · observing · cue available · tracking limited · paused · ended.

## Cue behavior (PRD §7.4, §8)
Small, private, nonblocking; appears only after a sustained pattern; auto-dismisses;
dismissible; respects cooldown; never covers the preview; pause stops decisions, not preview.
On end: **stop the camera stream and release tracks** (PRD §6, §12, §17.12).

## Uses
`state/useLiveSession` loop + `coaching.getActiveCue()`, the whole `lib/*` pipeline.
