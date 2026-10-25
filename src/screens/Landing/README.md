# `Landing` — public landing page (`/`)

**Owner:** UI / App-shell · **Depends on:** `state/profileStore`, shared components, `assets/bluejay_final.jpg`

Hero, privacy note, how a session works, what truely. won't do, who it's for, closing call to action
(`docs/FRONTEND_GUIDE.md` §3.1).

## Rules
- One focal point: the hero headline and the blue jay plate. Everything below is quieter.
- No stats, testimonials, sample scores, or fake screenshots (CLAUDE.md §5).
- Never requests the camera.
- "Start a session" goes to `/start` before setup is finished, `/calibrate` after. Returning people
  also get "Open your journal" (`/home`) and the site nav.
