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

## Floating overlay (stay on top while in a meeting)
"Float over" moves the session into an always-on-top window. Logic in
`components/useFloatingOverlay` + `FloatingOverlay`, layout in `SessionOverlay.tsx`.
Opening needs a click (browser rule). Two backends:

| Where | How | Seen by screen shares? |
| --- | --- | --- |
| truely. desktop app (`npm run desktop:dev`) | `window.open` → frameless Electron window, OpenCluely-style: `setContentProtection(true)`, always-on-top at `screen-saver` level, off the taskbar (`electron/main.cjs`) | No on Windows 10 2004+ and macOS*; yes on Linux |
| Chrome / Edge 116+ | Document Picture-in-Picture window, floats over tabs | Yes |
| Other browsers | Not available; a note points to Chrome, Edge, or the desktop app | n/a |

\* macOS capture tools built on ScreenCaptureKit (macOS 15+) may still record protected
windows, which is why the copy says "most" screen shares.

Desktop overlay controls: drag it by the status row; ✕ docks it back. While it's open
the shell registers `Ctrl/Cmd+Shift+H` (hide / show) and `Ctrl/Cmd+Shift+K` (click-through,
so clicks reach the meeting below). Both are released when the overlay closes, and the
overlay always says which mode it's in.

- The window shares this page's JS context: React renders into it through a portal and
  the overlay `<video>` shows the same `MediaStream`. Nothing leaves the device.
- Closing the window, or "Bring it back here", returns the preview to the page. Ending the
  session, or leaving `/session`, closes it.
- In a browser this tab is usually hidden while floating, so its timers are throttled and
  `requestAnimationFrame` stops. The session timer ticks from the overlay window's clock.
  (The desktop shell turns background throttling off.)
  **CV team:** when the frame loop lands, drive it from the overlay window
  (`overlayWindow.requestAnimationFrame`) or `video.requestVideoFrameCallback` while
  floating, or it will stall in the browser when the person switches tabs.
