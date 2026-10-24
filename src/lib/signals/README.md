
# `signals` module

**Owner:** Computer-Vision team (shared with Personalization) · **Depends on:** `vision`

Converts `VisionFrame`s into clean, normalized `SignalObservation`s. See PRD §7.1, §9.

## Public surface (`index.ts`)

- `createSignalExtractor()` → `SignalExtractor` with `update / reset`.

## Contract

- Smooths + normalizes so thresholds are unit-independent (PRD §7.2).
- Marks `valid: false` when tracking is too poor to trust.
- Pure/stateful math only — no React, no DOM beyond what `vision` passes.

## Done when

- Emits stable, normalized observations with confidence for each supported signal.

## SignalHub and aligned observations

`SignalHub` is the recommended entry point for coordinating camera/vision observations, optional microphone observations, and time alignment.

- `SignalHub` coordinates the signal sources. Audio is opt-in.
- `SignalPipeline` processes webcam frames and emits vision observations.
- `SignalAligner` aligns observations by timestamp and marks stale observations invalid.
- `SignalHub` exposes `start`, `pause`, `resume`, `stop`, and `dispose` lifecycle methods.
- `stop` and `dispose` release active camera and microphone streams.

## Signal meanings and limitations

- `head_yaw_proxy` and `head_pitch_proxy`: experimental, unitless head-orientation proxies. Interpret changes relative to the user's own baseline.
- `head_motion`: estimated movement in face-widths per second. It may have a nonzero value when the user is still.
- `voice_level_db`: microphone input level in dBFS.
- `voice_active`: heuristic voice activity indicator (`0` or `1`), not speech-rate estimation.

An observation with `valid: false` represents unreliable or missing data, not a measurement of zero. Confidence is a tracking-quality heuristic, not a calibrated probability.

The system measures observable behavior; it does not measure confidence, honesty, or intent. Combine signals through explicit rules and per-signal baselines rather than treating them as a fused psychological score.
