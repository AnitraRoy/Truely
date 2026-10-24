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
