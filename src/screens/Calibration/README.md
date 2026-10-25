# Screen B — Goal Selection & Calibration

**Owner:** Screen B team · **Route:** `/calibrate` · PRD §6 Screen B

Three steps on one flow:
1. **Choose a goal** (one only): camera engagement / head movement / general awareness.
2. **Webcam permission** — clear user action, preview, status, privacy note, denied-state retry.
3. **Calibration** — head range only (look up, down, left, right, guided on the preview).
   The person is never asked to speak: how they want to sound is their desired style,
   set on `/profile/style`, and the ready state hands off there.

## Rules
- Don't imply constant direct eye contact is required/desirable (PRD §6, §8.9).
- Completion copy: "Your camera baseline is ready…" — no fabricated precision/personality assessment.

## Uses
`camera`, `vision`, `signals`, `personalization.calibrate()`, `config/coaching`.
