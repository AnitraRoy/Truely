# `components` — shared UI primitives

**Owner:** Design System team (consumed by all screen teams)

Reusable, screen-agnostic pieces: buttons, cards, the privacy banner, the
camera-active indicator, status chips, the cue toast, timeline rows.

Rule: if two screens need it, it lives here — don't duplicate behavioral rules
or UI across screens (PRD §13 Maintainability). Status indicators must use text
+ shape, never color alone (PRD §11 Accessibility).
