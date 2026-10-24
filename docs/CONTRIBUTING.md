# Contributing

## Workflow
1. Work inside **your team's folder(s)** — see [`OWNERSHIP.md`](OWNERSHIP.md).
2. Branch per feature: `git checkout -b <area>/<short-desc>` (e.g. `vision/head-pose`).
3. Code against the types in `src/types`. Don't reach into another module's internals —
   use its exported `index.ts` surface only.
4. Keep logic in `lib/*` (no React there) so it's unit-testable.
5. Put tests in each module's `__tests__/` folder. Add tests for baseline + cue logic (PRD §13).
6. Open a PR; tag the owning team. **Changes to `src/types` or `src/config` need a heads-up**
   since they affect everyone.

## Conventions
- TypeScript strict mode is on. No `any` without a comment justifying it.
- Import with the `@/` alias (e.g. `import type { Session } from "@/types"`).
- Thresholds/cooldowns go in `src/config/coaching.ts` — never hardcode them inline.
- UI: status via text **and** shape, never color alone; support reduced motion (PRD §11).

## Guardrails (don't ship a PR that violates these — PRD §4, §8, §15)
- No webcam frames leave the device; no raw video persisted.
- No inference about personality, honesty, confidence, or mental state.
- No fabricated scores, progress, or insights.
- Never require constant direct eye contact.

## Definition of done
Each folder's `README.md` lists its "Done when". The MVP acceptance checklist is PRD §17.
