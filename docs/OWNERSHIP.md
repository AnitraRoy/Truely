# Ownership map

Suggested split so people work in dedicated, low-collision spaces. Adjust team
sizes to your crew — the folder boundaries are what keep merges clean.

| Team | Owns (folders) | Deliverable |
|------|----------------|-------------|
| **Computer-Vision** | `src/lib/camera`, `src/lib/vision`, `src/lib/signals` | Webcam → clean, normalized signal observations with confidence |
| **Personalization** ⭐ | `src/lib/personalization`, `src/lib/coaching`, `src/config/coaching.ts` | Baseline + deviation detection + cue state machine (the differentiator) |
| **Data** | `src/lib/sessions`, `src/lib/reports`, `src/lib/storage` | Session lifecycle, timeline/insights, IndexedDB persistence |
| **Screen A** | `src/screens/Dashboard` | Dashboard + start/empty states |
| **Screen B** | `src/screens/Calibration` | Goal selection + webcam permission + calibration |
| **Screen C** ⭐ | `src/screens/LiveCoaching` | The live coaching session (most important screen) |
| **Screen D** | `src/screens/PostSession` | Report: summary, timeline, insights, feedback |
| **App-shell / State** | `src/App.tsx`, `src/state`, routing | Engine wiring, the per-frame loop hook, global state |
| **Design System** | `src/styles`, `src/components`, `tailwind.config.ts` | Tokens + shared UI primitives |

## Shared / change-by-review
- `src/types/index.ts` — the integration contract. Ping the group before changing a type.
- `src/config/coaching.ts` — Personalization owns it, but everyone reads it.

## Dependency order (who can start immediately)
`types` + `config` + Design System unblock everyone. CV and Data teams can build and
unit-test their `lib/*` modules against the types with **no UI**. Screen teams can build
against the type stubs and swap in real engines as they land. This is deliberate: nobody
waits on anybody (PRD §13 Maintainability).
