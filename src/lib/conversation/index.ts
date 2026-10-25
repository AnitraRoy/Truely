/**
 * Conversation practice engine: the voice coach, the mock interviewer, live
 * suggestions, post-session reports, and desired-style analysis.
 * Owner: Coaching + Integration. Framework-agnostic (no React).
 *
 * Every model call goes through `lib/services` (Moss inference) and resolves to
 * null on failure, so a screen can always fall back to an honest state. The
 * prompts hold the product's ethics line (CLAUDE.md §5): talk about what was
 * said, never about the person's traits, confidence, honesty or feelings; no
 * scores; feedback must quote the transcript it is based on.
 */
import { llmReply, runApifyActor, type ChatMessage } from "@/lib/services";
import { APIFY_REFERENCE_ACTOR, FEEDBACK_CATEGORIES, INTERVIEW_QUESTION_COUNT, REFERENCE_MAX_CHARS } from "@/config/conversation";
import type { CommunicationProfile, ConversationKind, ConversationReport, TranscriptSegment } from "@/types";
import { parseLiveSuggestion, parseReport, parseStyle, parseTurn, str, type ParsedSuggestion } from "./parse";

export * from "./parse";

const ETHICS =
  "Comment only on observable aspects of what was said: clarity, conciseness, structure, pacing, relevance, warmth, delivery. " +
  "Never judge personality, confidence, honesty, intelligence, emotions or mental state. Never give a score or grade. " +
  "Be calm, specific, brief and encouraging. Use second person.";

const CATS = FEEDBACK_CATEGORIES.join(" | ");

/** The desired-style profile, condensed for a system prompt. */
export function describeProfile(profile: CommunicationProfile | null, goals: string[]): string {
  const kept = profile?.traits.filter((t) => t.keep) ?? [];
  const lines = [
    goals.length ? `Their goals for this session: ${goals.join("; ")}.` : "",
    profile?.intent ? `What they want to work toward: ${profile.intent}` : "",
    kept.length ? `Patterns they chose to practise: ${kept.map((t) => `${t.name} (${t.description})`).join("; ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const toHistory = (transcript: TranscriptSegment[]): ChatMessage[] =>
  transcript.map((t) => ({ role: t.role === "you" ? "user" : "assistant", content: t.text }));

/** Transcript lines with ids, so the model can cite them. */
const numbered = (transcript: TranscriptSegment[]) =>
  transcript.map((t) => `[${t.id}] ${t.role === "you" ? "You" : (t.speaker ?? "Other")}: ${t.text}`).join("\n");

export interface TurnResult {
  reply: string;
  suggestions: ParsedSuggestion[];
}

/** Voice coach: respond to the person's last answer and suggest up to three small changes. */
export async function coachTurn(input: {
  prompt: string;
  profile: CommunicationProfile | null;
  goals: string[];
  transcript: TranscriptSegment[];
}): Promise<TurnResult | null> {
  const system = [
    "You are Cue, a voice communication coach running a short question-and-answer practice.",
    `The person is practising this: "${input.prompt}".`,
    describeProfile(input.profile, input.goals),
    ETHICS,
    "After each answer: reply in at most two spoken sentences (acknowledge one thing that worked, then ask them to try again or go one step further).",
    `Then give 0 to 3 suggestions about their LAST answer only. Each: {"category": one of ${CATS}, "title": imperative, max 6 words, "why": one sentence quoting or pointing at what they said, "try": optional short example phrasing}.`,
    'Respond with JSON only: {"reply": string, "suggestions": [...]}',
  ]
    .filter(Boolean)
    .join("\n");
  const history: ChatMessage[] =
    input.transcript.length === 0 ? [{ role: "user", content: "I'm ready. Ask me to start." }] : toHistory(input.transcript);
  return parseTurn(await llmReply(system, history, { temperature: 0.5, maxTokens: 500 }));
}

/** Mock interviewer: the next question (or a closing line once enough questions were asked). */
export async function interviewerTurn(input: {
  type: string;
  role: string;
  difficulty: string;
  goals: string[];
  transcript: TranscriptSegment[];
  questionNumber: number;
}): Promise<string | null> {
  const last = input.questionNumber > INTERVIEW_QUESTION_COUNT;
  const system = [
    `You are a professional interviewer running a ${input.type.toLowerCase()} for: ${input.role || "a general role"}.`,
    `Difficulty: ${input.difficulty}.`,
    "Speak naturally, as in a real spoken interview. Ask ONE question at a time. React to the candidate's last answer in at most one short sentence, then ask a relevant follow-up or a new question.",
    "Never answer for the candidate, never coach them, never evaluate them out loud.",
    last ? "This is the end of the interview: thank them warmly in one or two sentences and say the interview is complete. Do not ask another question." : `This is question ${input.questionNumber} of ${INTERVIEW_QUESTION_COUNT}.`,
    "Reply with only what you would say out loud.",
  ].join("\n");
  const history: ChatMessage[] =
    input.transcript.length === 0 ? [{ role: "user", content: "Hello, I'm ready to begin." }] : toHistory(input.transcript);
  const text = await llmReply(system, history, { temperature: 0.7, maxTokens: 220 });
  return text ? str(text, 700) || null : null;
}

/** Live conversation: at most one discreet suggestion, or null to stay quiet (the default). */
export async function liveSuggestion(input: {
  profile: CommunicationProfile | null;
  goals: string[];
  transcript: TranscriptSegment[];
}) {
  const recent = input.transcript.slice(-12);
  const system = [
    "You are Cue, a discreet coach listening to a real conversation. The person will glance at your suggestion while talking, so it must be very short.",
    describeProfile(input.profile, input.goals),
    ETHICS,
    "Most of the time, say nothing. Only suggest when a recent line clearly shows a chance to apply one of their goals.",
    `If nothing is worth saying, respond {"suggest": false}. Otherwise respond {"suggest": true, "segmentId": the id of the line it is based on, "category": one of ${CATS}, "title": imperative, max 7 words, "why": one short sentence}.`,
    "JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
  const text = await llmReply(system, [{ role: "user", content: numbered(recent) }], { temperature: 0.3, maxTokens: 160 });
  return parseLiveSuggestion(text, recent);
}

const KIND_LABEL: Record<ConversationKind, string> = {
  voice: "voice coaching practice",
  interview: "mock interview",
  live: "real conversation",
};

/** Post-session reflection built only from the transcript. Moments must cite real line ids. */
export async function buildConversationReport(input: {
  kind: ConversationKind;
  profile: CommunicationProfile | null;
  goals: string[];
  transcript: TranscriptSegment[];
}): Promise<ConversationReport | null> {
  if (!input.transcript.some((t) => t.role === "you")) return null;
  const system = [
    `You are writing a short, private reflection on the person's ${KIND_LABEL[input.kind]} for them to read afterwards.`,
    describeProfile(input.profile, input.goals),
    ETHICS,
    "Never claim a suggestion caused a change. Only describe what the transcript shows.",
    "Respond with JSON only:",
    '{"summary": 1-2 sentences, "strengths": up to 3 short items, "improvements": up to 3 short items, "nextSteps": up to 3 short imperative items,',
    ' "moments": up to 4 of {"segmentId": an id from the transcript, "label": 2-4 words, "note": one sentence about what that line shows}}',
  ]
    .filter(Boolean)
    .join("\n");
  const text = await llmReply(system, [{ role: "user", content: numbered(input.transcript) }], { temperature: 0.3, maxTokens: 900 });
  return parseReport(text, input.transcript);
}

// -----------------------------------------------------------------------------
// Desired style (Stage 1): read a public reference, then extract patterns
// -----------------------------------------------------------------------------

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname);
  } catch {
    return false;
  }
}

export type ReferenceResult =
  | { ok: true; title?: string; text: string }
  | { ok: false; reason: "unsupported_url" | "no_transcript" | "service"; error?: string };

/** Fetch a public YouTube transcript through the allow-listed Apify actor. */
export async function fetchReference(url: string): Promise<ReferenceResult> {
  if (!isYouTubeUrl(url)) return { ok: false, reason: "unsupported_url" };
  const res = await runApifyActor({
    actorId: APIFY_REFERENCE_ACTOR,
    input: { startUrls: [{ url }], languages: ["en"], subType: "both", outputFormats: ["llm"], enableAiFallback: false },
    limit: 1,
  });
  if (!res.ok) return { ok: false, reason: "service", error: res.error };
  const item = (res.items[0] ?? {}) as { transcript_llm?: unknown; transcript_text?: unknown; metadata?: { title?: unknown }; error?: unknown };
  const text = str(item.transcript_llm ?? item.transcript_text, REFERENCE_MAX_CHARS);
  if (!text) return { ok: false, reason: "no_transcript", error: str(item.error, 200) || undefined };
  return { ok: true, title: str(item.metadata?.title, 140) || undefined, text };
}

/** Understand the request (NLP) and extract observable patterns from the reference text. */
export async function extractStyle(input: { admire: string; contexts: string[]; referenceText?: string }) {
  const system = [
    "You help someone describe the communication style they want to work toward.",
    "First restate, in one sentence starting with a verb, what they want to improve (\"intent\").",
    input.referenceText
      ? "Then identify 3 to 5 observable communication patterns in the reference material that match what they admire: sentence structure, vocabulary, answer organisation, pacing cues, presentation style."
      : "No reference material was supplied, so derive 3 to 5 practisable patterns from their own description.",
    "Patterns are practice goals, not rules to imitate. Describe language, never the speaker's personality.",
    `Respond with JSON only: {"intent": string, "traits": [{"category": one of ${CATS}, "name": 1-3 words, "description": one practical sentence, "evidence": optional short quote from the reference}]}`,
  ].join("\n");
  const user = [
    `What I admire: ${input.admire || "(not given)"}`,
    input.contexts.length ? `Where I'll use it: ${input.contexts.join(", ")}` : "",
    input.referenceText ? `Reference material:\n${input.referenceText.slice(0, REFERENCE_MAX_CHARS)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return parseStyle(await llmReply(system, [{ role: "user", content: user }], { temperature: 0.3, maxTokens: 700 }));
}
