import type { VideoReviewData } from "./types";

/**
 * Development fixture for the video review UI.
 *
 * truely. does not record video, audio, or speech during a session (PRD §12 /
 * `src/lib/storage`), so no real session will ever have a recording or
 * transcript to show here. This sample data exists purely so the video
 * player, playback-bar markers, and synced transcript can be built, reviewed,
 * and tested end to end before that capability exists. It is clearly labeled
 * wherever it appears (see the "Dev fixture" pill on the player and the
 * notice in `PostSession`) and is never presented as a real observation.
 *
 * `videoSrc` is intentionally left unset: there's no provenanced recording to
 * ship. Instead `youtubeVideoId` points at a public YouTube video, embedded
 * via the official IFrame Player API purely as a stand-in so the player,
 * markers, and transcript sync can be reviewed against real video playback —
 * it is not footage of any truely. session. `durationMs` below is a fallback
 * estimate; the player replaces it with the placeholder's real duration once
 * the embed reports one.
 */
const min = (m: number, s = 0) => (m * 60 + s) * 1000;

export const DEV_VIDEO_REVIEW_FIXTURE: VideoReviewData = {
  youtubeVideoId: "Mmw-PpWhKFg",
  fixture: true,
  durationMs: min(6, 40),
  markers: [
    { id: "m1", kind: "observation", atMs: min(0, 42), label: "Gaze drifted off-camera", transcriptSegmentId: "t2" },
    { id: "m2", kind: "cue", atMs: min(1, 2), label: "Cue: bring your gaze back to the camera", transcriptSegmentId: "t4" },
    { id: "m3", kind: "cue", atMs: min(1, 5), label: "Cue: settle into a steady position", transcriptSegmentId: "t4" },
    { id: "m4", kind: "highlight", atMs: min(2, 30), label: "Flagged by you during the session", transcriptSegmentId: "t7" },
    { id: "m5", kind: "observation", atMs: min(4, 10), label: "Head movement settled near baseline", transcriptSegmentId: "t11" },
    { id: "m6", kind: "cue", atMs: min(5, 20), label: "Cue: notice your head movement", transcriptSegmentId: "t14" },
  ],
  transcript: [
    { id: "t1", startMs: min(0, 0), endMs: min(0, 18), speaker: "You", text: "Thanks for taking the time to meet — I wanted to walk through where the project stands." },
    { id: "t2", startMs: min(0, 18), endMs: min(0, 47), speaker: "You", text: "We shipped the first milestone last week, and the early feedback has been pretty encouraging so far." },
    { id: "t3", startMs: min(0, 47), endMs: min(1, 2), speaker: "Interviewer", text: "That's great to hear. What was the biggest surprise along the way?" },
    { id: "t4", startMs: min(1, 2), endMs: min(1, 28), speaker: "You", text: "Honestly, how much the onboarding flow needed to change once real users touched it." },
    { id: "t5", startMs: min(1, 28), endMs: min(1, 50), speaker: "You", text: "We'd assumed people would read the setup guide, and almost nobody did." },
    { id: "t6", startMs: min(1, 50), endMs: min(2, 12), speaker: "Interviewer", text: "How did you adjust once you saw that?" },
    { id: "t7", startMs: min(2, 12), endMs: min(2, 40), speaker: "You", text: "We moved the key steps into the product itself, so there's nothing extra to go read." },
    { id: "t8", startMs: min(2, 40), endMs: min(3, 5), speaker: "You", text: "That change alone cut our support questions by a noticeable margin." },
    { id: "t9", startMs: min(3, 5), endMs: min(3, 30), speaker: "Interviewer", text: "What's next on the roadmap?" },
    { id: "t10", startMs: min(3, 30), endMs: min(3, 58), speaker: "You", text: "Mainly performance — a few flows get slow once someone has a lot of saved data." },
    { id: "t11", startMs: min(3, 58), endMs: min(4, 25), speaker: "You", text: "We've already profiled the slow paths, so the next sprint is just fixing them." },
    { id: "t12", startMs: min(4, 25), endMs: min(4, 50), speaker: "Interviewer", text: "Anything you'd do differently if you started over?" },
    { id: "t13", startMs: min(4, 50), endMs: min(5, 15), speaker: "You", text: "I'd bring in a couple of real users earlier, even with something rough." },
    { id: "t14", startMs: min(5, 15), endMs: min(5, 42), speaker: "You", text: "We waited until things felt polished, and that cost us a few weeks of guessing." },
    { id: "t15", startMs: min(5, 42), endMs: min(6, 10), speaker: "Interviewer", text: "That's a fair trade-off. Thanks for walking through it." },
    { id: "t16", startMs: min(6, 10), endMs: min(6, 35), speaker: "You", text: "Of course — happy to go deeper into any part of it." },
  ],
};
