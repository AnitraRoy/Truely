/**
 * Video review — shared types (video player + synced transcript).
 * Owner: Design System team.
 *
 * Cue does not record video, audio, or speech during a session (see
 * `src/lib/storage` — sessions persist only derived metrics, "never
 * frames/video"). These types describe a *future* capability the UI is built
 * to support, and the *development fixture* used to design and test it in
 * the meantime (see `fixtures.ts`). Nothing here is wired to real recordings.
 */

/** What a marker on the playback bar represents. */
export type ReviewMarkerKind = "cue" | "observation" | "highlight";

export interface ReviewMarker {
  id: string;
  kind: ReviewMarkerKind;
  /** Offset from the start of the recording, in ms. */
  atMs: number;
  label: string;
  /** The transcript segment active at this moment, if any. */
  transcriptSegmentId?: string;
}

export interface TranscriptSegment {
  id: string;
  /** Offsets from the start of the recording, in ms. */
  startMs: number;
  endMs: number;
  text: string;
  /** Only shown when speaker identification is available. */
  speaker?: string;
}

/**
 * Everything the video review section needs. Neither `videoSrc` nor
 * `youtubeVideoId` present → no recording exists (the honest, real-world
 * case today). `youtubeVideoId` is a public placeholder used only in the
 * development fixture, never a real session recording — Cue doesn't have
 * any (see `fixtures.ts`). `durationMs` is a fallback estimate; once a
 * YouTube placeholder reports its real duration, the player uses that
 * instead.
 */
export interface VideoReviewData {
  videoSrc?: string;
  youtubeVideoId?: string;
  durationMs: number;
  markers: ReviewMarker[];
  transcript: TranscriptSegment[];
}
