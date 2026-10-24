# `vision` module

**Owner:** Computer-Vision team · **Depends on:** `@mediapipe/tasks-vision`, `camera`

Turns raw video into landmark-based estimates. See PRD §9 (vision) and §7.1 (signals).

## Public surface (`index.ts`)
- `createVisionEngine()` → `VisionEngine` with `init / process / dispose`.
- Output type: `VisionFrame` (see `src/types`).

## Contract
- `init()` is lazy — do not load models before the user asks for the webcam (PRD §13).
- Reports `trackingConfidence` and `faceDetected`; downstream code must respect low confidence.
- Head pose is an **imperfect proxy**, never proof of where the user looks (PRD §7.1).

## Done when
- Produces `VisionFrame`s with head pose + confidence; degrades gracefully on occlusion/lighting.
