/**
 * The whole-session recording: the person's microphone and camera in one
 * file, for playback in the report. Owner: Design System team.
 *
 * On by default in every mode (CLAUDE.md §5), always shown while it runs, and
 * one switch turns it off before a session. The file stays on this device
 * (state/conversations, IndexedDB); it is never uploaded. It records the same
 * tracks the session already opened, so it never asks for a device itself.
 */
export interface SessionRecording {
  blob: Blob;
  durationMs: number;
  hasVideo: boolean;
}

export interface SessionRecorder {
  hasVideo: boolean;
  stop: () => Promise<SessionRecording | null>;
}

const VIDEO_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pick(types: string[]): string {
  return types.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

/** Start recording whichever of the two streams are live. Null when there is nothing to record. */
export function startSessionRecorder({ audio, video }: { audio?: MediaStream | null; video?: MediaStream | null }): SessionRecorder | null {
  if (typeof MediaRecorder === "undefined") return null;
  const live = (t: MediaStreamTrack) => t.readyState === "live";
  const tracks = [...(video?.getVideoTracks().filter(live).slice(0, 1) ?? []), ...(audio?.getAudioTracks().filter(live).slice(0, 1) ?? [])];
  if (tracks.length === 0) return null;
  const hasVideo = tracks.some((t) => t.kind === "video");
  const mimeType = pick(hasVideo ? VIDEO_TYPES : AUDIO_TYPES);
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
  } catch {
    return null;
  }
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  rec.start(1000);
  let stopped: Promise<SessionRecording | null> | null = null;
  return {
    hasVideo,
    stop: () =>
      (stopped ??= new Promise((resolve) => {
        const done = () => resolve(chunks.length ? { blob: new Blob(chunks, { type: rec.mimeType }), durationMs: Date.now() - startedAt, hasVideo } : null);
        if (rec.state === "inactive") return done();
        rec.onstop = done;
        rec.stop();
      })),
  };
}
