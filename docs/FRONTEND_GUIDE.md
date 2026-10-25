# Cue — Frontend & UI/UX Organization Guide

Derived from the PRD ("Idea Generation.pdf"), `CLAUDE.md`, and what already exists in the repo
(Field Journal art direction, 4 screens, shared primitives). It covers three additions: a **landing page
with hero banner**, a **profile page (settings + first-time setup)**, and a **report page** (history +
single report). It does not touch `src/lib/*` or change the type contract beyond optional fields.

---

## 1. Where we are today

| Area | Status |
| --- | --- |
| Routes | `/` Dashboard, `/calibrate`, `/session`, `/report/:sessionId` (`src/App.tsx`) |
| Art direction | **Field Journal** (oat paper, ink-indigo accent, ochre annotations, Fraunces / Newsreader / IBM Plex Mono). Tokens in `src/styles/tokens.css`. |
| Primitives | `Button`, `Pill`, `StatusChip`, `Masthead`, `Ledger`/`LedgerRow`, `SpecimenPlate`, `Timeline`, `WebcamFrame`, `CueBubble`, `useWebcamPreview` |
| Artwork | Audubon blue jay, Bewick yellowhammer (`src/assets`, provenance recorded) |
| State | `sessionStore` holds only `goal`, `status`, `isCalibrated`. No settings, no consent, no history. |
| Engines | `storage`, `sessions`, `reports` are stubs (`createStorageAdapter` throws). Report screen is an honest empty state. |

**Decisions**

1. **Theme (decided 2026-10-24).** The PRD §11 asked for a dark default; we stay with the light Field
   Journal as the default and identity. A *designed* dark scheme (ink-black paper, bone text, lifted
   accents) is **opt-in** from Profile → Settings → Theme, with "Match my device" as a third choice. It
   is implemented in `src/styles/tokens.css` (`data-theme="dark"` / `"system"` on `<html>`) and applied
   with `applyTheme()` from `src/styles/theme.ts`. No attribute means light.
2. **"Profile" without accounts.** PRD §5 says no account in the prototype. So "profile" is a
   **local device profile**: nothing to sign in to, all data in IndexedDB. Never imply a cloud account.

---

## 2. Information architecture

Ten journal screens (Figma: "Truely — Communication Coaching Product - Reports"), in two groups.
The brand stays **Cue**; the concept file's "truely" name is not used.

```
APP SCREENS
/home                      01 Overview            one suggested next step from real state (home icon)
/profile?tab=style         02 Communication profile  a tab of My profile: Apify reference + Moss patterns
/practice/voice            03 Voice coaching      Moss coach, Cartesia speech in/out, typing always works
/practice/interview        04 Mock interviews     Moss interviewer, Cartesia speech, live transcript
/session                   05 Live coaching       preflight consent, then preview/transcript (CLAUDE.md §6)
/reports                   06 Session history     all kinds, filter + search, rows open their report
/profile                   10 My profile          tabs: Review · Communication profile · Settings · Data

SESSION REPORT BOARDS (one layout: src/components/report/ReportParts.tsx)
/report/interview/:id      07 Mock interview report  recording or timeline + synced transcript
/report/voice/:id          08 Voice session report   before/after moments, coach notes
/report/live/:id           09 Live coaching report   timeline of moments + transcript
/report/:sessionId         camera-signals report for live sessions without a transcript (PostSession)

OTHER
/                          Landing (public)   /start  First-time setup   /calibrate  Calibration
```

Routing rules:

- `/session` (once started) and `/calibrate` never show the app shell (distraction-free).
- Every app screen uses `AppShell`, with two toolbars fed by one list of tools (same names in both):
  - **Top toolbar:** the "Cue." wordmark (links to the landing page `/`), a home icon (Home, `/home`),
    then My profile, Practise out loud, Rehearse an interview, Coach me live, Review sessions.
  - **Side toolbar** (`lg` and up): the journey in order, each tool with a one-line purpose:
    Home, Find your style, Practise out loud, Rehearse an interview, Coach me live, Review sessions;
    then Set-up: Calibrate camera, My profile.
  - Below `lg` the side toolbar is hidden and the top toolbar's Menu shows the same tools with their
    purpose lines (Escape closes it); the home icon stays.
- `/profile/style` redirects to `/profile?tab=style` so older links still work.
- In dev builds, `/report/<kind>/sample` shows a labelled fictional sample of each board.

### Data model (src/types)

`ConversationSession` holds transcript segments, feedback events and the optional report and
recording ref. Every timestamp is **ms from session start**, so the transcript, feedback, timeline
markers and recording share one clock. Feedback and report moments cite a `segmentId`; anything
that cites a line that doesn't exist is dropped (`lib/conversation/parse.ts`). Desired style
(`CommunicationProfile`) and natural baseline (`BehavioralBaseline`) are separate types and are never
combined. Calibration is camera-only (head range); nobody is asked to speak for a baseline. The
voice baseline *is* the desired style the person sets on `/profile/style`.

### Integrations (what is real, what isn't)

- **Moss** is used as an LLM (chat completions via the desktop bridge), not as a voice API.
- **Cartesia** does batch speech-to-text per answer / per ~9 s live chunk and text-to-speech for
  coach and interviewer lines, using a short-lived token. Streaming STT is not wired yet.
- **Apify** reads YouTube captions through the allow-listed actor. Other references are pasted text.
- All three only work in the desktop app with keys in `.env.local`; screens show `ServiceNotice`
  otherwise. Live suggestions and the live transcript use one microphone, so speakers aren't labelled.

---

## 3. Page specs

### 3.1 Landing page (`/`) — `src/screens/Landing`

**Purpose:** say what Cue is, what it won't do, and get the visitor to a first session.

**Focal point (one):** the hero headline + the specimen plate beside it. Reuse the Dashboard's
composition (asymmetric `1fr / minmax(280px,380px)` grid), since it already passes the squint test.

| Section | Content | Notes |
| --- | --- | --- |
| Hero banner | PRD headline "Show up as yourself. A little better every time." Supporting line on personalized real-time coaching. Primary **Start a session**; secondary **See how it works** (anchor). | The one expressive moment. Blue jay plate on the right. Not a banner of equal-weight columns. |
| Privacy strip | "Processed on your device. Nothing is uploaded; the camera turns on only when you start a session." | Ochre left rule, as on the Dashboard. Directly under the hero, never in the footer only. |
| How it works | The PRD §5 loop in four steps: choose a goal, calibrate a baseline, coach quietly, review. | A numbered `Ledger`, not four cards. |
| What Cue won't do | Does not judge personality, detect honesty, or score confidence; no raw video stored. | Plain list. Builds trust, supports ethics frame (§5). |
| Who it's for | The five PRD audiences, one line each. | Tertiary tier; small type. |
| Closing CTA | Repeat **Start a session**. | |

**Avoid:** testimonials, usage stats, "trusted by", fake screenshots of scores, floating cards,
gradients (CLAUDE.md §4, §5). Use the second asset (yellowhammer) only if a second plate is needed;
otherwise leave negative space.

### 3.2 First-time setup (`/start`) — `src/screens/Setup`

A short wizard that **absorbs Step 1 of today's Calibration screen** and adds consent. It is the only
place that asks for permissions in sequence; `/calibrate` stays for recalibration.

1. **Welcome + privacy:** what is processed locally, what is saved, what is never saved.
2. **Goal:** one primary goal (`camera_engagement`, `head_movement`, `general_awareness`), with the
   existing "looking at the camera isn't the goal" note.
3. **Consent to save metrics:** explicit opt-in toggle, *off by default* (PRD §4.4). Declining is a fully
   supported path. Session recordings are separate: on by default per session, always indicated, kept on this
   device, and a recorded session is kept on disk with its recording so it can be played back.
4. **Camera:** permission through a user click; preview via `WebcamFrame`; denied and no-device states
   with next-step instructions and a retry button (PRD §6 Screen B).
5. **Baseline:** hand off to the existing calibration phase (30–60 s). On completion, route to `/home`
   with a "Start session" action.

UX rules: progress shown as text ("Step 2 of 5"), not color alone; Back always works; the camera is
never requested before step 4; leaving mid-way keeps answers already given.

### 3.3 Profile page (`/profile`) — `src/screens/Profile`

Three tabs (APG tabs pattern; native `<a>`/`<button>` roles, arrow-key support):

**Overview**
- `Ledger` rows: Goal (change inline), Baseline (calibrated date / "not calibrated"), Sessions saved
  (count or "none"), Metrics saving (on/off).
- Actions: **Recalibrate**, **Change goal**.

**Settings** (all persisted locally; each has a visible label and help text)
| Setting | Default | Source |
| --- | --- | --- |
| Primary goal | from setup | PRD §5 |
| Visual cue notifications (mute) | on | PRD §6 Screen C |
| Cue visible time | from config | `COACHING_CONFIG.cueVisibleMs` (read-only display or bounded choice) |
| Cue frequency (Fewer / Standard) | Standard | feeds cooldown multiplier; PRD §7.5 |
| Show optional signal visualization on Live | off | PRD §6 Screen C |
| Theme (Light journal / Dark / Match my device) | Light journal | `THEME_LABELS`, `applyTheme()` |
| Reduced motion | system | honor `prefers-reduced-motion`, allow override |

The UI never hardcodes thresholds; it reads `src/config/coaching.ts` and stores only user *overrides*.

**Data & privacy**
- Plain statement of what is stored (consented derived metrics) and what is not (video, frames).
- **Save session metrics** toggle (the consent from setup).
- **Delete session history**, **Reset baseline**, **Reset everything** (calls `resetAll`). Each is a
  confirm dialog naming exactly what is removed; never red, use the muted amber warning token.
- Optional later: export my data (JSON).

### 3.4 Report pages

**History (`/reports`)** — a `Ledger` list, newest first: date, goal, duration, cue count. Empty state
stays honestly empty ("No sessions filed yet"). If the user declined saving metrics, say so and link
to Profile → Data & privacy rather than showing an unexplained empty list. Row opens the report.

**Single report (`/report/:sessionId`)** — keep the current structure, fill it from `lib/reports`.

| Block | Content (PRD §6 Screen D) | Rules |
| --- | --- | --- |
| Header | Goal, date, duration | No quality score, ever. |
| Summary ledger | Duration, behavioral events, cues shown, cues dismissed (if tracked), whether the signal moved after a cue (if supported) | Counts only. |
| Timeline (focal) | Horizontal, timestamped: deviations, cues, post-cue period, tracking gaps | Make it the largest element; the yellowhammer plate recedes. Text/shape for each event type, not color alone. Run `dataviz` first. |
| Event detail | On select: timestamp, signal, observed behavior, why the cue fired, what the signal did afterward | "Observation, not causation" wording; keyboard-selectable events. |
| Insights | At most three, each backed by session data | Hide the block if none qualify. |
| Cue feedback | "Was this cue helpful?" → Helpful / Not helpful / Too distracting, stored on the `CoachingEvent` | Radio group per cue; can be skipped. |
| Actions | Start another session · Return to dashboard · View previous sessions | |

---

## 4. Components

**Reuse as is:** `Button`, `Pill`, `StatusChip`, `Masthead`, `Ledger`, `SpecimenPlate`, `Timeline`,
`WebcamFrame`, `useWebcamPreview`.

**New shared primitives** (built; in `src/components`, tested in
`src/components/__tests__/primitives.test.tsx`):

| Component | Used by | Notes |
| --- | --- | --- |
| `SiteNav` | Landing, Dashboard, Reports, Profile | `Masthead` + `NavLink`s; `aria-current` on the active page |
| `Stepper` | Setup | "Step n of N: Name" in text; `aria-current="step"` |
| `Tabs` | Profile | APG automatic activation, roving tabindex, arrow/Home/End; controlled |
| `Toggle` | Profile, Setup | `role="switch"`, shows "On"/"Off" in text |
| `SettingRow` | Profile | label, help (`helpId` for `aria-describedby`), control |
| `ConfirmDialog` | Data & privacy | native `<dialog>`, focus on Cancel, warning-token rule, no red |
| `PrivacyNote` | Landing, Setup, Dashboard | `DEFAULT_PRIVACY_COPY`; Dashboard now uses it |
| `FeedbackGroup` | Report | native radios, `FEEDBACK_LABELS`, chosen answer marked with ✓ |
| `EmptyState` | History, Report, Dashboard | title, explanation, optional action |

Screens compose these; they don't reimplement them (CLAUDE.md §7).

---

## 5. State and data

Add to `src/state` (additive, no engine changes):

```ts
// profileStore.ts (persisted via storage adapter once implemented; localStorage as interim for UI prefs only)
interface ProfileState {
  setupComplete: boolean;
  consentSaveMetrics: boolean;
  settings: {
    muteCues: boolean;
    cueFrequency: "standard" | "fewer";
    showSignalViz: boolean;
    theme: ThemePreference; // "light" (default) | "dark" | "system" — src/styles/theme.ts
    reducedMotion: "system" | "on";
  };
}
```

- `goal` and `isCalibrated` move from "session-only" to **hydrated from storage** on load.
- History pages read `StorageAdapter.listSessions()`; the report reads `getSession(id)` then
  `createReportBuilder()`.
- Until `createStorageAdapter` is implemented (it currently throws), wrap it in a try/catch hook and
  show the honest empty state. Do **not** seed fake sessions.
- Any new field on `Session`/`CoachingEvent` (e.g., `dismissed?: boolean`) is optional and goes through a
  PR review of `src/types/index.ts`.

---

## 6. Folder layout

```
src/
  screens/
    Landing/index.tsx            new
    Setup/index.tsx              new (wizard; owns step components below)
    Setup/steps/{Welcome,Goal,Consent,Camera}.tsx
    Dashboard/index.tsx          existing → route /home
    Calibration/index.tsx        existing → recalibration only
    LiveCoaching/index.tsx       existing, unchanged scope
    Reports/index.tsx            new (history)
    PostSession/index.tsx        existing → single report
    Profile/index.tsx            new
    Profile/{Overview,Settings,DataPrivacy}.tsx
  components/                    + the new primitives in §4
  state/profileStore.ts          new
  styles/tokens.css              + dark scheme block, no hex in components
```

Every screen folder keeps its `README.md` stating owner and "done when", as the others do.

---

## 7. Design and content rules (apply to all three pages)

- **One focal point per screen, three tiers.** Landing: headline + plate. Profile: the current tab's
  primary setting group. Report: the timeline.
- **One expressive moment per screen.** Landing: hero headline treatment. Profile and Report: none beyond
  the masthead rule; Setup: the plate on the welcome step only.
- **Copy:** observable behavior only, second person, calm. Errors say what to do next.
- **No fabricated data** in empty states, previews, or the landing page.
- **Accessibility floor:** WCAG 2.2 AA, visible focus, targets ≥ 24px, labelled controls, reduced motion,
  no color-only state. Check both schemes.
- **Banned list (§4):** no gradients, glassmorphism, mascots, coded SVG illustration, shadow-card kits,
  pulsing motion; also avoid ALL-CAPS eyebrows on every heading. (The current `Step 1 · choose a goal`
  labels are a pattern to reduce when Setup is rebuilt.)
- **Artwork:** only real assets with provenance. Any new plate needs a `PROVENANCE.md` row; otherwise a
  marked `TODO(art)` placeholder.

---

## 8. Build order

1. **Tokens:** ~~add the dark scheme~~ (done). Still open: spacing/type-scale tokens, since components
   still use arbitrary `text-[Npx]` values.
2. **Primitives:** ~~`SiteNav`, `Tabs`, `Toggle`, `SettingRow`, `ConfirmDialog`, `Stepper`, `EmptyState`,
   `FeedbackGroup`, `PrivacyNote`~~ (done).
3. **State:** ~~`profileStore`, hydration, guarded storage access~~ (done: `src/state/profileStore.ts`,
   zustand `persist` to localStorage under `cue-profile`, storage errors swallowed; `App.tsx` applies the
   theme and seeds `sessionStore.goal` from `primaryGoal`; `index.html` applies the theme before paint).
4. **Screens in dependency order:** ~~Setup~~ (done: `/start`, `src/screens/Setup`; Dashboard's "Start a
   session" routes there until `setupComplete`; `GoalPicker` is shared with `/calibrate`), ~~Profile~~
   (done: `/profile`, tab in `?tab=`; data actions in `src/state/savedData.ts` degrade honestly while
   `lib/storage` is a stub; Dashboard now uses `SiteNav`, whose Reports link is hidden until `/reports`
   exists; reduce-motion override sets `data-motion="reduce"`; new `ChoiceGroup` primitive and `scrim`
   token), ~~Landing (move current Dashboard to `/home`)~~ (done: `src/screens/Landing`; the blue jay
   plate moved there from the Dashboard, which is now the returning hub with recent sessions; the
   wordmark links to `/home` in `SiteNav` and to `/` in Setup; shared date/duration helpers live in
   `src/components/format.ts`), ~~Reports history~~ (done: `/reports`,
   `src/screens/Reports`; a real `<table>` whose date cell links to `/report/:id`; `useSavedSessions()`
   in `savedData.ts` returns sessions newest first; two empty states, saving off vs. nothing filed;
   Reports link back in `SiteNav`; Post-session report gained "View previous sessions"), then fill the
   single report from `lib/reports` once the engine lands.
5. **Routing:** ~~update `App.tsx` per §2~~ (done). There is no automatic redirect: `/` stays the landing
   page for everyone, and returning people get the site nav plus "Open your journal" there (see open
   question 2).
6. **Review:** run `design-review` on each screen and `dataviz` before the timeline work; then
   `npm run build`, `npm run lint`, `npm run test`.

## 9. Open questions

1. ~~Dark default or light?~~ Decided: light Field Journal default, dark opt-in (§1).
2. Should `/home` remain separate from the landing page, or should returning users skip the landing page entirely?
3. Is a profile name or avatar wanted? Recommendation is no: it adds nothing without accounts.
4. Who owns the new screens (`docs/OWNERSHIP.md` lists only the original four)?
5. ~~Baseline-only delete~~ Resolved by `main`'s `CueStorage.clearBaselines()`. `src/state/savedData.ts`
   now wraps the real storage (`getStorage()` is the one shared instance; pass it to
   `createSessionController` when Live Coaching is wired). The profile's saving consent is mirrored into
   `storage.setConsent()` from `App.tsx`, since the controller reads consent from storage.
7. **For the report screen:** `components/Timeline` still uses its own point-entry type; move it onto
   `lib/reports`' `Timeline`/`TimelineItem` model (spans, response windows, paused periods).
6. **For Live Coaching:** `muteCues`, `cueFrequency`, and `showSignalViz` are stored in `profileStore`
   but nothing reads them yet.
