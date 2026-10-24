export interface AudioCalibration {
  noiseFloorDb: number;      // 90th percentile of the quiet phase
  speechThresholdDb: number; // above this = speaking
  speechMeanDb: number;      // mean level of speech frames only (pauses excluded)
  speechSdDb: number;
  quietSamples: number;
  speechSamples: number;     // speech frames used
  calibratedAt: number;      // Date.now()
}

export type CalibrationFailureReason =
  | "not_enough_quiet_samples"
  | "not_enough_speech_samples"
  | "speech_not_distinguishable_from_noise";

export type CalibrationResult =
  | { ok: true; calibration: AudioCalibration }
  | { ok: false; reason: CalibrationFailureReason; message: string };

// Tunable. Tell Person 3 these exist.
export const CALIBRATION_CONSTANTS = {
  minQuietSamples: 30,       // ~3 s at 10 samples/s
  minSpeechFrames: 50,       // ~5 s of actual speech
  speechFrameMarginDb: 6,    // a sample counts as speech if this far above the noise floor
  minSeparationDb: 10,       // speech must sit at least this far above the noise floor
  thresholdFraction: 0.4,    // threshold = floor + 40% of the way to median speech level
  minThresholdMarginDb: 6,
} as const;

function percentile(sortedAsc: number[], p: number): number {
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * (sortedAsc.length - 1))));
  return sortedAsc[i] ?? 0;
}

function fail(reason: CalibrationFailureReason, message: string): CalibrationResult {
  return { ok: false, reason, message };
}

export class AudioCalibrator {
  private quiet: number[] = [];
  private speech: number[] = [];

  addQuiet(levelDb: number): void {
    if (Number.isFinite(levelDb)) this.quiet.push(levelDb);
  }

  addSpeech(levelDb: number): void {
    if (Number.isFinite(levelDb)) this.speech.push(levelDb);
  }

  reset(): void {
    this.quiet = [];
    this.speech = [];
  }

  finish(now: number = Date.now()): CalibrationResult {
    const c = CALIBRATION_CONSTANTS;

    if (this.quiet.length < c.minQuietSamples) {
      return fail("not_enough_quiet_samples", "Not enough quiet audio. Check that the mic is working and try again.");
    }
    const quietSorted = [...this.quiet].sort((a, b) => a - b);
    const noiseFloorDb = percentile(quietSorted, 0.9);

    const frames = this.speech
      .filter((db) => db > noiseFloorDb + c.speechFrameMarginDb)
      .sort((a, b) => a - b);
    if (frames.length < c.minSpeechFrames) {
      return fail("not_enough_speech_samples", "Not enough speech detected. Speak a bit louder or for longer.");
    }

    const medianSpeech = percentile(frames, 0.5);
    if (medianSpeech - noiseFloorDb < c.minSeparationDb) {
      return fail(
        "speech_not_distinguishable_from_noise",
        "Your voice is too close to the background noise. Move closer to the mic or find a quieter spot."
      );
    }

    const speechThresholdDb =
      noiseFloorDb + Math.max(c.minThresholdMarginDb, c.thresholdFraction * (medianSpeech - noiseFloorDb));
    const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
    const sd = Math.sqrt(frames.reduce((a, b) => a + (b - mean) ** 2, 0) / frames.length);

    return {
      ok: true,
      calibration: {
        noiseFloorDb,
        speechThresholdDb,
        speechMeanDb: mean,
        speechSdDb: sd,
        quietSamples: this.quiet.length,
        speechSamples: frames.length,
        calibratedAt: now,
      },
    };
  }
}