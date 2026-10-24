# `camera` module

**Owner:** Computer-Vision team · **Depends on:** browser APIs only

Manages webcam lifecycle and permissions. See PRD §9 (camera) and §4.4 (privacy).

## Public surface (`index.ts`)
- `createCameraController()` → `CameraController` with `start / stop / getStream / getPermission`.

## Contract
- Emits/returns a `MediaStream` the `vision` module consumes.
- Never persists or transmits frames.
- On `stop()` and on session end, all tracks are released (PRD §6 Screen C, §12).

## Done when
- User can grant/deny permission; missing devices are handled; preview appears on grant.


## Public surface

Exports include `createCameraController`, `openCamera`, `releaseStream`, `CameraController`, `CameraPermission`, `CameraErrorCode`, and `CameraResult`. See `index.ts` for the complete export list.
