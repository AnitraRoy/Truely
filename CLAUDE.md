# CLAUDE.md — Frontend Design & UI/UX Standards

This file governs how the **frontend / UI-UX** of Cue is designed and built. It is the
design constitution: read it before touching anything under `src/screens`,
`src/components`, `src/styles`, or `tailwind.config.ts`. Engine logic lives in
`src/lib/*` and is out of scope for design changes (see "Boundaries" below).

---

## 1. What Cue is (design in one paragraph)

Cue is a **privacy-first, real-time communication coach**. It learns a person's
on-camera baseline during a short calibration, then offers *discreet, timely* cues when
it detects a sustained, goal-relevant deviation — and otherwise stays quiet. The product
promise is: **"a coach that learns when to leave you alone and when to help."** The UI
must feel like a calm, premium instrument for *personal observation*, never a
surveillance dashboard or a medical/clinical tool.

**Tone, always:** professional, trustworthy, encouraging, nonjudgmental. The visual
identity reinforces *personal observation, not judgment or surveillance.*

---

## 2. Skills to use (load before the matching task)

| Task | Skill |
| --- | --- |
| Aesthetic direction, typography, distinctive identity, new UI, composition (§4A) | `/frontend-design:frontend-design` |
| Building/auditing tokens, type scale, color, spacing, components | `/anthropic-skills:design-system` |
| Critiquing a built page's layout, a11y, responsiveness | `/anthropic-skills:design-review` |
| Any chart, meter, sparkline, timeline, KPI tile | `dataviz` |
| Building a self-contained HTML mockup/prototype | `artifact-design`, `artifact-diagramming` |
| Removing templated/AI-tell copy | `/anthropic-skills:humanizer` |

**Always** run `design-review` on a screen before calling it done, and run `dataviz`
before writing the first line of any timeline/signal visualization.

## 3. Additional resources & authorities

- **WCAG 2.2 AA** is the floor. Contrast ≥ 4.5:1 body / 3:1 large & UI; visible focus;
  target size ≥ 24px. Never convey state by color alone — pair with text/icon/shape
  (see `StatusChip`).
- **ARIA Authoring Practices Guide (APG)** for any custom widget (tabs, dialogs,
  disclosure, toggle). Prefer native elements first.
- **Inclusive Components** (Heydon Pickering) patterns for accessible primitives.
- **Refactoring UI** (Wathan/Schoger) for hierarchy, spacing, and restraint.
- **The Elements of Typographic Style** for the type scale and measure (< 80ch).
- **prefers-reduced-motion** and **prefers-color-scheme** are respected everywhere.
- Fonts: load only from Google Fonts or self-host; pick deliberately per the chosen
  art direction, never the project default sans.

---

## 4. Non-negotiable "do not use" list

From the art-direction brief — these read as the generic AI-startup aesthetic and are
**banned** regardless of direction:

- ❌ Purple-blue gradients; glowing orbs; glassmorphism (frosted blur panels).
- ❌ Generic AI illustrations / mascots / abstract 3D blobs.
- ❌ Hand-coded or model-generated SVG used as "illustration" (see §4A.3).
- ❌ Evenly weighted layouts where nothing is clearly the focal point (see §4A.1).
- ❌ Decorative floating cards; drop-shadow-on-everything SaaS card kits.
- ❌ Excessive rounded surfaces (one radius on everything regardless of hierarchy).
- ❌ Unnecessary charts, gauges, or "dashboard" density on the live screen.
- ❌ Bright-red alerts for ordinary behavioral deviations.
- ❌ Pulsing alerts or attention-grabbing ambient motion.

Also avoid the common generated-page tells: tracked-out ALL-CAPS eyebrows over every
heading, `A · B · C` middot meta strings, `WORD — fragment` spaced-em-dash labels, a `→`
glued onto every link, one accent word colored in a headline, and monospace used purely
as decoration. Use a device only when it encodes real information.

---

## 4A. Composition, theme & artwork

Restraint (§4) is not timidity. A screen should read as *designed*, with a point of view,
not as a tidy arrangement of defaults. Spend boldness deliberately, in the places below.

### 4A.1 Bold spatial composition with a real focal hierarchy

- **One focal point per screen**, obvious within a second and without reading: the largest,
  highest-contrast, most generously spaced element. Everything else is demonstrably
  subordinate. If two things compete, one of them is wrong.
- **Use scale and space as the primary tools of hierarchy**, ahead of borders, boxes, and
  color. Decide the focal element's size first, then let the rest recede around it.
- **Compose the whole canvas**, not a centered column of equal-width stacked sections.
  Use deliberate asymmetry, a dominant column against a narrow one, large uninterrupted
  fields of negative space, and elements that anchor to edges or break the grid on purpose.
  Empty space is a compositional element; do not fill it to avoid looking sparse.
- **Establish 3 tiers, not 7**: primary (focal), secondary (supports a decision), tertiary
  (peripheral, quiet). Tier is communicated by size, weight, contrast, and position together.
- **Alignment is structural.** Pick a few strong axes and hold them; one intentional
  grid-break per screen reads as confidence, several read as noise.
- **Test it:** squint (or blur the screenshot). The focal point must still be identifiable
  and the reading order must still make sense. If it fails, fix composition, not decoration.
- The Live Coaching rule (§6) is the clearest case: the camera preview *is* the focal
  hierarchy, and bold composition there means giving it the space and contrast, not adding
  to the screen.

### 4A.2 Expressive use of theme

- The theme is the product's personality, carried by **token choices**, not by ornament:
  a distinctive type pairing, a committed palette with a clear dominant and a sharp accent,
  a considered surface/texture treatment, and a consistent motion character.
- **Commit to the chosen art direction** from `design/explorations.html`. A timid blend of
  every direction is worse than any single one. Dominant colors with one sharp accent beat
  an evenly distributed palette.
- **Let theme change what the layout does**, not just what it is painted. Typographic scale
  contrast, the weight of edges versus fills, rhythm of spacing, and the pace of transitions
  should all feel like the same voice.
- Express theme **through tokens** (`src/styles/tokens.css`). Re-skinning by editing tokens
  must still work; expressive does not mean hard-coded one-offs in components.
- Theme must stay inside the ethics frame (§5) and tone (§1): calm, trustworthy, warm,
  nonjudgmental. Expressive is not loud. Light and dark schemes are each designed, not
  auto-inverted, and both meet WCAG AA.
- Each screen gets **one expressive moment** (a headline treatment, a color field, an
  artwork placement). The Live Coaching screen's is the quiet quality of the preview
  framing itself; it gets no decorative moment.

### 4A.3 Genuine pre-drawn artwork, not generated SVG

- **Illustration, spot art, textures, and brand imagery must be real, pre-drawn artwork**
  made by an artist or designer (hand-drawn, painted, printmaking, or properly authored
  vector/raster files delivered as assets). They are not produced by writing SVG path code in
  a component or by asking a model to emit SVG shapes.
- **Source of truth:** artwork lives in the repo as files (e.g. `design/assets/` for the
  working set, `src/assets/` for shipped files), referenced by import. Finals are the files
  already named `*_final.*`; do not substitute a re-drawn approximation.
- **Provenance is required.** Each asset has a known origin and license, recorded alongside
  it (author, source, date, license). No provenance, no ship.
- **Do not fake it.** If a needed illustration doesn't exist yet, leave an honest,
  clearly-marked placeholder (flat neutral block with the intended aspect ratio and a
  `TODO(art)` note) and flag it. Never ship coded blobs, gradient-mesh shapes, procedurally
  generated "organic" forms, or SVG doodles as stand-in artwork.
- **What SVG is still for:** functional iconography, the logo/wordmark once delivered by
  design, and data marks in signal visualizations (per `dataviz`). SVG in those roles is
  fine; SVG as *picture-making* is not.
- **Handling:** serve appropriately sized, compressed files (responsive `srcset`/modern
  formats where useful), always with meaningful `alt` text, or `alt=""` and
  `aria-hidden` when purely decorative. Artwork must never carry information that exists
  nowhere else, never sit under body text without a contrast-safe treatment, and respect
  `prefers-reduced-motion` if animated. Artwork never appears on the Live Coaching screen
  (§6), and must not compete with the camera preview anywhere it appears alongside it.
- Artwork choices still obey §4 and §5: no mascots, no faces implying inferred traits, and
  nothing that frames the person as a subject under inspection.

---

## 5. Ethics guardrails that shape the UI (PRD §4, §8, §15)

- **Observable behavior only.** Copy describes what was measured ("Your gaze shifted away
  several times"), never inferred traits. Never imply confidence, honesty, attention,
  personality, or mental state.
- **No fabricated data.** Never render invented scores, percentages, improvement stats,
  streaks, or historical charts to "look complete." Empty states stay honestly empty.
- **No overall quality score.** The post-session report shows observations and counts,
  never a graded verdict, and never claims a cue *caused* a change.
- **Private by default, recorded by default.** Nothing leaves the device except what a
  feature names (speech to Cartesia, text to Moss). The camera-active state is always
  unmistakable; a stop/end control is always obvious. The webcam preview is the person's
  own — framed as a mirror, not a subject under inspection.
- **Recording is on by default, never hidden.** Every mode records video and audio (as
  available) for playback in the report, kept on this device only, never uploaded. The
  setup screen shows the switch already on with a one-tap off, and a "Recording" indicator
  is visible for as long as it runs. Live sessions with other people also require the
  person to confirm everyone agreed to be recorded.
- **Nonjudgmental language.** Supportive, calm, second person. Errors explain what to do
  next; they do not scold.

---

## 6. Live-session rule (the most important screen)

Regardless of art direction, the Live Coaching screen (`src/screens/LiveCoaching`) must
stay **distraction-free**:

1. The **camera preview is the focal point** — largest, centered, highest contrast.
2. **Coaching cues are discreet** — small, private, nonblocking, auto-dismissing, with a
   dismiss affordance; they never cover the preview or pulse for attention.
3. **Status information is secondary** — quiet, peripheral, legible without being read
   constantly. The person should not need to watch the UI.

---

## 7. Engineering standards

- **Reusable TypeScript components.** Shared primitives live in `src/components`. Screens
  compose primitives; they don't re-implement buttons, chips, cue bubbles, timelines.
- **Centralized design tokens.** All color/space/type/radius/motion values come from
  `src/styles/tokens.css` (CSS custom properties) exposed through `tailwind.config.ts`.
  **No hard-coded hex, px spacing, or font stacks in components.** Changing a token
  re-skins the app — that is the test of whether the system is centralized.
- **Tailwind-first**, using token-backed utilities (`bg-surface`, `text-text-muted`,
  etc.). One radius scale, one space scale, one type scale.
- **Accessibility is a build requirement, not a pass:** keyboard operable, visible focus,
  labelled controls, reduced-motion honored, contrast checked.
- **Validate** after UI changes: `npm run build` (tsc + vite), `npm run lint`,
  `npm run test`. A screen is not done until these pass and `design-review` is clean.

## 8. Boundaries — preserve the working integrations

- `src/types/index.ts` is the **shared contract** between the CV/session engines and the
  UI. Treat changes as API changes; prefer additive, optional fields.
- `src/lib/*` (camera, vision, signals, personalization, coaching, sessions, reports,
  storage) is framework-agnostic engine code. **Design/UI work does not rewrite it.**
  Screens consume it via `src/state` and the types.
- `src/config/coaching.ts` holds every threshold/cooldown/cue string. UI reads these;
  it never hardcodes cue copy or timing.
- The webcam lifecycle and MediaPipe wiring are owned by the CV team — UI mounts the
  preview and reflects status; it must not change stream handling semantics.

---

## 9. Design workflow for this project

1. **Explore before committing.** For a new identity, produce distinct directions and
   review them against the brief (and this file) before building the real thing.
2. **Tokens → primitives → screens.** Define tokens first, build/adjust shared
   components, then compose screens. Never the reverse.
3. **Self-critique.** Screenshot, review hierarchy and restraint ("remove one
   accessory"), spend boldness in exactly one place per screen. Run the squint test
   (§4A.1): is the focal point unmistakable, is theme carried by tokens (§4A.2), and is
   every picture a real asset with provenance rather than coded SVG (§4A.3)?
4. **Review + validate**, then ship.
