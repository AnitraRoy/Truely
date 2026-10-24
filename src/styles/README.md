# `styles` — design system

**Owner:** Design System team

- `tokens.css` — the single source of color tokens (PRD §11). Change the brand here.
- Tailwind maps these tokens to utility classes in `tailwind.config.ts`.

Principles (PRD §11): minimal, calm, focused, trustworthy, accessible, nonjudgmental.
Calm is not timid: tokens should carry an expressive, committed theme (distinctive type
pairing, dominant palette with one sharp accent, considered surfaces and motion) and
support bold, asymmetric composition with a clear focal hierarchy. See `CLAUDE.md` §4A.
Illustration and brand imagery are pre-drawn asset files, never tokens or coded SVG.
No information conveyed by color alone; reduced-motion supported in `index.css`.
