/**
 * Video review — shared types (video player + synced transcript).
 * Owner: Design System team.
 *
 * Plays a session's recording (video and audio, or audio only), kept on this
 * device by state/conversations, with markers for suggestions, camera cues
 * and report moments. The behavioral report (PostSession) still shows the
 * development fixture (see `fixtures.ts`), which is never a real recording.
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
 * development fixture, never a real session recording — truely. doesn't have
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
