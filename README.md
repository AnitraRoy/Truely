# Cue — Personalized Real-Time Communication Coach

A privacy-first web app that learns your on-camera baseline and offers discreet,
timely coaching during webcam sessions. Hackathon MVP. See the PRD for the full spec.

> **Core promise:** a coach that learns *when to leave you alone* and *when to help.*

## Tech stack
React · Vite · TypeScript · Tailwind CSS · MediaPipe Face Landmarker · IndexedDB.
All webcam processing is **local by default** — no frames leave the browser.

## Getting started
```bash
npm install
npm run dev
```
Other scripts: `npm run build`, `npm run test`, `npm run lint`.

## Repo layout
```
src/
├─ types/            Shared type contract — the integration boundary (edit via review)
├─ config/           Thresholds, cooldowns, goals, cue library (tune, don't hardcode)
├─ lib/              Framework-agnostic engines, one folder per team area:
│  ├─ camera/        webcam lifecycle + permissions      (CV team)
│  ├─ vision/        MediaPipe landmarks → head pose      (CV team)
│  ├─ signals/       smoothing + normalization            (CV team)
│  ├─ personalization/  baselines + deviation detection ⭐ (Personalization team)
│  ├─ coaching/      cue state machine + the 10 rules      (Personalization team)
│  ├─ sessions/      session lifecycle + metrics           (Data team)
│  ├─ reports/       timeline + summaries + insights       (Data team)
│  └─ storage/       IndexedDB persistence                 (Data team)
├─ state/            zustand store + engine wiring          (App-shell team)
├─ components/       shared UI primitives                   (Design System team)
├─ screens/          the 4 PRD screens, one folder each:
│  ├─ Dashboard/        Screen A  (Screen A team)
│  ├─ Calibration/      Screen B  (Screen B team)
│  ├─ LiveCoaching/     Screen C ⭐ (Screen C team)
│  └─ PostSession/      Screen D  (Screen D team)
└─ styles/           design tokens                          (Design System team)
```

## Working in parallel
Every folder has its own `README.md` describing its owner, public surface, and
"done when" criteria. Teams build against the shared types in `src/types` so work
proceeds independently. See [`docs/OWNERSHIP.md`](docs/OWNERSHIP.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Ethics guardrails (PRD §4, §8, §15)
Observable behavior only — never infer confidence, honesty, personality, or mental
state. No fabricated scores or insights. Private by default. Non-judgmental language.
