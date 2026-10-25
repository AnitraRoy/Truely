# Architecture

Cue is a client-only app. One per-frame pipeline drives everything; each stage is an
independent module behind a type in `src/types`, so any stage can be replaced without
rewriting the others (PRD §9).

## The live pipeline

```
 camera ──MediaStream──▶ vision ──VisionFrame──▶ signals ──SignalObservation──▶ personalization
                                                                                      │
                                                                         DeviationAssessment
                                                                                      ▼
   UI (screens) ◀── CueState / CoachingEvent ── coaching ◀────────────────────────────┘
        │                                            │
        └── sessions ──Session──▶ reports        feedback
                        │
                     storage (IndexedDB)
```

1. **camera** acquires the webcam stream.
2. **vision** runs MediaPipe → `VisionFrame` (head pose + tracking confidence).
3. **signals** smooths + normalizes → `SignalObservation`.
4. **personalization** compares against the user's baseline → `DeviationAssessment`.
5. **coaching** runs the §7.4 state machine + §8 rules → a `CoachingEvent` / `CueState`.
6. **sessions** records events; **reports** builds the post-session timeline; **storage**
   persists consented aggregates. Frames are never stored; the separate session
   recording (video + audio, `components/sessionRecorder`, on by default and always
   indicated) is kept on this device by `state/conversations` for report playback.

## Boundaries
- `lib/*` is framework-agnostic (no React). It's the testable core (PRD §13).
- `state/` wires engines into React; `screens/` and `components/` render.
- `src/types` is the shared contract — treat changes as API changes.
- `src/config/coaching.ts` holds every threshold/cooldown (PRD §13).

## Key invariants (PRD §8)
No cue without tracking confidence · no cue for a momentary blip · no cue while paused ·
no duplicate/early-repeat cue · goal-relevant signals only · no personality inference ·
no improvement claim unless measured · no network transmission of frames or recordings.
