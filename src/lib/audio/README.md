
# Audio module

Processes microphone input locally to estimate input level and heuristic voice activity.

## Calibration

`AudioCalibrator` uses approximately 5 seconds of quiet input followed by 30–60 seconds of natural speech. `finish()` returns an `AudioCalibration` containing calibration measurements, or a failure reason.

Calibration data is plain JSON and can be persisted per profile. Without calibration, voice activity uses a fallback heuristic with confidence `0.5`.

## Signals

- `voice_level_db`: microphone input level in dBFS.
- `voice_active`: heuristic voice activity (`0` or `1`).

Voice activity uses hysteresis and an approximately 400 ms hangover so gaps between words are not immediately treated as pauses. This is not speaking-rate estimation.

## Privacy and setup

Audio uses the microphone only, not system audio. Speaker output can leak into the microphone, so headphones are recommended. Raw audio is not stored or sent by this module.
