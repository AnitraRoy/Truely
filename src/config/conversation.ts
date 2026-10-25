/**
 * Conversation practice configuration: voice coaching, mock interviews, and the
 * live-conversation transcript. Owner: Integration + Coaching teams.
 *
 * Like `coaching.ts`, every timing, provider id and piece of user-facing copy
 * for these flows lives here so screens never hardcode them. Copy stays
 * observational and nonjudgmental (CLAUDE.md §5): it talks about what was
 * said, never about who the person is.
 */
import type { FeedbackCategory } from "@/types";

/** Cartesia models and voices. Same ids as scripts/smoke-services.mjs. */
export const CARTESIA = {
  sttModel: "ink-whisper",
  /** Realtime model for the live transcript's streaming websocket (word by word). */
  liveSttModel: "ink-2",
  ttsModel: "sonic-3.6",
  /** One calm voice for both the coach and the interviewer. */
  voiceId: "a0e99841-438c-4a64-b679-ae501e7d6091",
  sampleRate: 24000,
} as const;

/**
 * Apify actors Stage 1 uses. Each must also be in DEFAULT_ACTORS in
 * electron/services.cjs (the main-process allow-list), or the call is refused.
 */
/** Reads a public YouTube video's captions, with timing. */
export const APIFY_REFERENCE_ACTOR = "codepoetry/youtube-transcript-ai-scraper";
/** Searches YouTube for candidate talks/interviews (metadata only, no transcripts). */
export const APIFY_SEARCH_ACTOR = "streamers/youtube-scraper";
/** Reads one public web page (an article, a transcript page) as clean text. */
export const APIFY_ARTICLE_ACTOR = "apify/website-content-crawler";

/** Candidate videos shown after a search. */
export const REFERENCE_SEARCH_LIMIT = 5;
/** Search results shorter than this are skipped: too little speech to learn a style from. */
export const REFERENCE_MIN_VIDEO_SECONDS = 120;
/** A gap between caption lines at least this long counts as a pause. */
export const PACING_PAUSE_SECONDS = 1;

/** Only this much reference text is sent to the model for style analysis. */
export const REFERENCE_MAX_CHARS = 9000;

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  clarity: "Clarity",
  conciseness: "Conciseness",
  structure: "Structure",
  pacing: "Pacing",
  relevance: "Relevance",
  warmth: "Warmth",
  delivery: "Delivery",
};

export const FEEDBACK_CATEGORIES = Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[];

/** Where the person wants to use their style. Multi-select on the profile screen. */
export const STYLE_CONTEXTS = ["Job interviews", "Team meetings", "Presentations", "Conferences", "Client calls"] as const;

/** Voice coaching: things to practise explaining. The person can also write their own. */
export const VOICE_PROMPTS = [
  "Explain a project update to someone outside your team.",
  "Walk through a decision you made recently and why.",
  "Describe what you do to someone you have just met.",
  "Ask your manager for something you need.",
] as const;

export const INTERVIEW_TYPES = [
  "Behavioral interview",
  "Technical interview",
  "Internship interview",
  "Professional presentation",
] as const;

export const INTERVIEW_DIFFICULTIES = [
  { value: "warmup", label: "Warm-up", detail: "Friendly, one follow-up at most." },
  { value: "realistic", label: "Realistic", detail: "Typical pace and follow-ups." },
  { value: "challenging", label: "Challenging", detail: "Probing follow-ups, less time to think." },
] as const;
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number]["value"];

/** Default practice goals offered before the profile has its own traits. */
export const DEFAULT_PRACTICE_GOALS = ["Answer with structure", "Lead with the main point", "Use one concrete example"] as const;

/** How many questions a mock interview runs before it wraps up. */
export const INTERVIEW_QUESTION_COUNT = 6;

/** Live conversation transcript + suggestions. */
export const LIVE_CONVERSATION = {
  /** New transcript lines required before another suggestion is considered. */
  minNewSegments: 1,
  /** Minimum gap between two suggestions, so the person is still mostly left alone. */
  suggestionCooldownMs: 30000,
} as const;

/** Voice coaching: suggestions shown at once (newest first). */
export const VOICE_MAX_SUGGESTIONS = 3;

/**
 * Silence check on recorded answers and live chunks, so speech-to-text never
 * receives a clip with no one talking (it tends to invent words from silence).
 */
export const SPEECH_CHECK = {
  /** How often the microphone level is sampled while a clip records. */
  tickMs: 100,
  /** Less voiced time than this and the clip is treated as silent. */
  minVoicedMs: 600,
} as const;

/** Practice call room (MeetingStage). */
export const PRACTICE_CALL = {
  /** The key that starts and stops an answer, as `KeyboardEvent.code`, and its label. */
  answerKey: "Space",
  answerKeyLabel: "Space",
} as const;

/** Plain-language reasons a provider isn't available, keyed by the service error. */
export const SERVICE_UNAVAILABLE_COPY: Record<string, string> = {
  desktop_only: "This needs the Cue desktop app, where your service keys stay private.",
  not_configured: "The service isn't set up yet. Add its key to .env.local and restart the desktop app.",
};
