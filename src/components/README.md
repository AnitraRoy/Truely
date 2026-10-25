# `components` — shared UI primitives

**Owner:** Design System team (consumed by all screen teams)

Reusable, screen-agnostic pieces: buttons, cards, the privacy banner, the
camera-active indicator, status chips, the cue toast, timeline rows.

Rule: if two screens need it, it lives here — don't duplicate behavioral rules
or UI across screens (PRD §13 Maintainability). Status indicators must use text
+ shape, never color alone (PRD §11 Accessibility).

Artwork rule (`CLAUDE.md` §4A.3): components that show illustration or brand imagery
take a real, pre-drawn asset file (with `alt` or `aria-hidden`), not inline SVG drawn in
code. Inline SVG is for functional icons and data marks only. Primitives should make the
focal element easy to scale up and the supporting ones easy to recede (§4A.1).

Two artwork primitives, both fed only by plates in `src/assets` (registry: `src/assets/art.ts`):

- `SpecimenPlate`: a plate tipped in and captioned. The screen's expressive moment (Landing, Setup welcome).
- `FieldArt`: a plate printed faintly behind the page and faded toward the content, filling
  deliberate empty space. Decorative (`aria-hidden`), token-coloured, hidden below `md`. Usually
  reached through `AppShell`'s `art` prop, which also adds the side-toolbar woodcock. Never beside a
  camera preview.
