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
import { llmReply, type ChatMessage } from "@/lib/services";
import { FEEDBACK_CATEGORIES, INTERVIEW_QUESTION_COUNT, REFERENCE_MAX_CHARS } from "@/config/conversation";
import type { CommunicationProfile, ConversationKind, ConversationReport, SpeechMetrics, TranscriptSegment } from "@/types";
import { describeSpeechMetrics } from "./pacing";
import { extractJson, parseLiveSuggestion, parseReport, parseStyle, parseSuggestions, parseTurn, str, type ParsedSuggestion } from "./parse";

export * from "./parse";
export * from "./pacing";
export * from "./reference";
export * from "./quickCues";

const ETHICS =
  "Comment only on observable aspects of what was said: clarity, conciseness, structure, pacing, relevance, warmth, delivery. " +
  "Never judge personality, confidence, honesty, intelligence, emotions or mental state. Never give a score or grade. " +
  "Be calm, specific, brief and encouraging. Use second person.";

const CATS = FEEDBACK_CATEGORIES.join(" | ");

/**
 * How live cues are written (coach, interview, live): short, sharp imperatives
 * the person can act on mid-sentence. Still only about what was said, never
 * about who they are.
 */
const CUE_ETHICS =
  "Comment only on observable aspects of what was said: clarity, conciseness, structure, pacing, relevance, warmth, delivery. " +
  "Never judge personality, confidence, honesty, intelligence, emotions or mental state. Never give a score or grade. Use second person.";

const CUE_STYLE = [
  'Each cue "title" is a sharp coaching cue of 2 to 5 words: a plain imperative they can act on at once.',
  'Examples of the style: "Get back on track", "Stop rambling", "Answer the question", "Address the second part", "Give an example", "Cut filler words", "Lead with your answer", "Slow down", "Wrap it up", "Be specific", "Name the result".',
  "Check relevance first, against the question or topic and their goals:",
  '- drifted off topic or into detail that doesn\'t serve the question or their goals → "Get back on track" or "Answer the question";',
  '- long-winded, repetitive or circling → "Stop rambling" or "Wrap it up";',
  '- part of the question left unanswered → "Address [that part]", naming it in at most 3 words (e.g. "Address the timeline");',
  "then anything else worth fixing next time. Cues are for what they say next, never a recap of what already happened.",
  '"why" is one short sentence, at most 15 words, saying what prompted it.',
].join("\n");

/** The desired-style profile, condensed for a system prompt. */
export function describeProfile(profile: CommunicationProfile | null, goals: string[]): string {
  const kept = profile?.traits.filter((t) => t.keep) ?? [];
  const lines = [
    goals.length ? `Their goals for this session: ${goals.join("; ")}.` : "",
    profile?.intent ? `What they want to work toward: ${profile.intent}` : "",
    kept.length ? `Patterns they chose to practice: ${kept.map((t) => `${t.name} (${t.description})`).join("; ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const toHistory = (transcript: TranscriptSegment[]): ChatMessage[] =>
  transcript.map((t) => ({ role: t.role === "you" ? "user" : "assistant", content: t.text }));

/** Transcript lines with ids, so the model can cite them. */
const numbered = (transcript: TranscriptSegment[]) =>
  transcript.map((t) => `[${t.id}] ${t.role === "you" ? "You" : (t.speaker ?? "Other")}: ${t.text}`).join("\n");

/** A line telling the model which suggestions were already given, so it doesn't repeat them. */
const alreadySaid = (previous: string[] | undefined) =>
  previous?.length ? `Suggestions already given this session (do not repeat these or rephrase them): ${previous.slice(-6).join("; ")}.` : "";

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
  /** Titles of suggestions already shown, newest last. */
  previous?: string[];
}): Promise<TurnResult | null> {
  const system = [
    "You are truely., a voice communication coach running a short question-and-answer practice.",
    `The person is practicing this: "${input.prompt}".`,
    describeProfile(input.profile, input.goals),
    CUE_ETHICS,
    "After each answer: reply in at most two spoken sentences (acknowledge one thing that worked, then ask them to try again or go one step further).",
    `Then give 1 to 3 cues about their LAST answer, most important first, judged against what they are practicing. Each: {"category": one of ${CATS}, "title": the cue, "why": string, "try": optional short example phrasing}.`,
    CUE_STYLE,
    alreadySaid(input.previous),
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
  /** What the conversation is, in the person's words (e.g. "Team check-in"). */
  context?: string;
  /** Titles of suggestions already shown, newest last. */
  previous?: string[];
}) {
  const recent = input.transcript.slice(-12);
  const system = [
    "You are truely., a discreet coach listening to a real conversation through one microphone, so lines are not labeled by speaker. The person glances at your suggestion while talking, so it must be very short.",
    input.context ? `The conversation: ${input.context}.` : "",
    describeProfile(input.profile, input.goals),
    CUE_ETHICS,
    "Look for an issue in the most recent lines, judged against the conversation's purpose and their goals: drifting off topic, rambling, not answering what was asked, missing a part, a claim with no example, filler, rushing. If there is one, give the one cue that fixes it. If the recent lines are fine, say nothing.",
    CUE_STYLE,
    alreadySaid(input.previous),
    `If nothing is worth saying, respond {"suggest": false}. Otherwise respond {"suggest": true, "segmentId": the id of the line that prompted it, "category": one of ${CATS}, "title": the cue, "why": string}.`,
    "JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
  const text = await llmReply(system, [{ role: "user", content: numbered(recent) }], { temperature: 0.3, maxTokens: 160 });
  return parseLiveSuggestion(text, recent);
}

/**
 * One cue while the person is still answering, or null when the answer is on
 * track. Called every few sentences of the streaming transcript, so a cue
 * appears as soon as an issue shows up rather than after the answer ends.
 */
export async function midAnswerCue(input: {
  /** The question or prompt being answered. */
  question: string;
  /** Their answer so far (still speaking). */
  partial: string;
  profile: CommunicationProfile | null;
  goals: string[];
  previous?: string[];
}): Promise<ParsedSuggestion | null> {
  const system = [
    "You are truely., watching someone answer out loud right now. They will glance at your cue mid-sentence.",
    describeProfile(input.profile, input.goals),
    CUE_ETHICS,
    "Look for an issue in the answer so far, against the question and their goals: drifting off topic, rambling, not answering, missing a part, a claim with no example, filler, rushing. If there is one, give the one cue that fixes it now. They are still talking: never ask them to expand, add structure or say more. If the answer is on track so far, say nothing.",
    CUE_STYLE,
    alreadySaid(input.previous),
    `Respond with JSON only: {"cue": false} or {"cue": true, "category": one of ${CATS}, "title": the cue, "why": string}.`,
  ]
    .filter(Boolean)
    .join("\n");
  const user = `Question: ${input.question}\nTheir answer so far: ${input.partial}`;
  const json = extractJson(await llmReply(system, [{ role: "user", content: user }], { temperature: 0.2, maxTokens: 120 }));
  if (!json || (json as { cue?: unknown }).cue === false) return null;
  return parseSuggestions([json], 1)[0] ?? null;
}

/**
 * Mock interview: up to two private suggestions about the answer just given.
 * The interviewer never coaches; these come from truely., beside the interview.
 */
export async function answerSuggestions(input: {
  question: string;
  answer: string;
  interview: string;
  profile: CommunicationProfile | null;
  goals: string[];
  previous?: string[];
}): Promise<ParsedSuggestion[]> {
  const system = [
    `You are truely., a private coach beside a mock ${input.interview}. The interviewer can't see you. The person reads your note before their next answer.`,
    describeProfile(input.profile, input.goals),
    CUE_ETHICS,
    `Give 1 or 2 cues about this answer, most important first, judged against the question asked and their goals. Each: {"category": one of ${CATS}, "title": the cue, "why": string, "try": optional short example phrasing}.`,
    CUE_STYLE,
    alreadySaid(input.previous),
    'Respond with JSON only: {"suggestions": [...]}',
  ]
    .filter(Boolean)
    .join("\n");
  const user = `Question: ${input.question}\nTheir answer: ${input.answer}`;
  const json = extractJson(await llmReply(system, [{ role: "user", content: user }], { temperature: 0.3, maxTokens: 400 }));
  return parseSuggestions((json as { suggestions?: unknown } | null)?.suggestions, 2);
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

/** Understand the request (NLP) and extract observable patterns from the reference text. */
export async function extractStyle(input: { admire: string; contexts: string[]; referenceText?: string; speech?: SpeechMetrics }) {
  const system = [
    "You help someone describe the communication style they want to work toward.",
    "First restate, in one sentence starting with a verb, what they want to improve (\"intent\").",
    input.referenceText
      ? "Then identify 3 to 5 observable communication patterns in the reference material that match what they admire: sentence structure, vocabulary, answer organization, pacing cues, presentation style."
      : "No reference material was supplied, so derive 3 to 5 patterns they can practice from their own description.",
    input.speech ? "Pacing numbers are provided below as measured facts. If you include a pacing pattern, base it on those numbers, not on a guess from the text." : "",
    "Patterns are practice goals, not rules to imitate. Describe language, never the speaker's personality.",
    `Respond with JSON only: {"intent": string, "traits": [{"category": one of ${CATS}, "name": 1-3 words, "description": one practical sentence, "evidence": optional short quote from the reference}]}`,
  ]
    .filter(Boolean)
    .join("\n");
  const user = [
    `What I admire: ${input.admire || "(not given)"}`,
    input.contexts.length ? `Where I'll use it: ${input.contexts.join(", ")}` : "",
    input.speech ? describeSpeechMetrics(input.speech) : "",
    input.referenceText ? `Reference material:\n${input.referenceText.slice(0, REFERENCE_MAX_CHARS)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return parseStyle(await llmReply(system, [{ role: "user", content: user }], { temperature: 0.3, maxTokens: 700 }));
}
