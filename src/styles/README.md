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

## Private Field Journal tokens (2026-10-24)

| Role | Token | Light | Notes |
| --- | --- | --- | --- |
| Paper | `bg` | #F3F0E8 | page |
| Sheet | `surface` | #FAF8F3 | raised working surface (`Sheet`) |
| Inset | `sunken` | #EAE6DC | wells, tracks, idle preview |
| Ink | `text-primary` | #252923 | 13.0:1 on paper |
| Soft ink | `text-muted` | #5A5E56 | 5.8:1 |
| Forest | `accent`, `accent-hover`, `on-accent` | #526B58 | primary buttons, the one forest field per screen |
| Ochre | `ochre` (text, 5.2:1) / `ochre-mark` (#B38A4A) | | `ochre-mark` is 2.8:1: rules, dots, selection bars only |
| Lines | `border` (#D9D4C8, divider) / `border-strong` (control edges, 3:1) | | |

Type: `font-display` Fraunces (headings), `font-sans` Instrument Sans (UI and body),
`font-serif` Newsreader (quoted speech, transcripts, marginal notes), `font-mono` Plex Mono
(timestamps and counts only). Radius: `rounded` 4px controls, `rounded-lg` 8px sheets.
Buttons: `primary` (forest, one per surface), `secondary` (outlined), `inverse` (on the forest
field), `ghost` (italic link). Dark scheme is designed separately in `tokens.css`.

## Artwork tokens (2026-10-24)

Faded plates printed behind pages (`FieldArt`, `src/components/FieldArt.tsx`). Engravings are alpha
masks painted in `--cue-art-ink`, so the dark scheme recolors them; the hand-colored plate goes
through `--cue-art-plate-filter`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--cue-art-ink` | ink | bone | engraving line color |
| `--cue-art-opacity` | 0.12 | 0.08 | page backdrops (keeps `text-muted` ≥ 4.5:1 over dense ink) |
| `--cue-art-opacity-strong` | 0.2 | 0.13 | small vignettes kept clear of text (side toolbar) |
| `--cue-art-plate-filter` | none | grayscale + invert | hand-colored plate in the dark scheme |

Placement: one backdrop per page, in its own empty space: `AppShell art={{ plate }}` (behind the
header) or `art={{ plate, place: "foot" }}` (foot of a short page). Never on a screen with a camera
preview (`quiet`), never on Live Coaching or Calibration.
