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

import type { TranscriptSegment } from "@/types";

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

/** Shared with conversation sessions, so reports and playback use one clock. */
export type { TranscriptSegment } from "@/types";

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
  /** `videoSrc` is an audio-only recording (practice sessions record the microphone only). */
  audioOnly?: boolean;
  /** Development fixture: the player shows a "Dev fixture" label. */
  fixture?: boolean;
}
