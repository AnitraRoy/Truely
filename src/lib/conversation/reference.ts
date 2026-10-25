/**
 * Stage 1 (Learn): find and read a public reference the person wants to sound like.
 *
 *   request ──planReferenceSearch (Moss)──▶ query
 *   query   ──searchReferences (Apify: YouTube search)──▶ candidate videos
 *   url     ──fetchReference (Apify: captions, or one web page)──▶ text (+ pacing)
 *
 * Everything resolves to { ok: false, reason } instead of throwing, so the
 * profile screen can always fall back to pasted text or hand-written patterns.
 * Only public material is read. Nothing here sees webcam frames.
 */
import {
  APIFY_ARTICLE_ACTOR,
  APIFY_REFERENCE_ACTOR,
  APIFY_SEARCH_ACTOR,
  REFERENCE_MAX_CHARS,
  REFERENCE_MIN_VIDEO_SECONDS,
  REFERENCE_SEARCH_LIMIT,
} from "@/config/conversation";
import { llmReply, runApifyActor } from "@/lib/services";
import type { SpeechMetrics } from "@/types";
import { computeSpeechMetrics, toCaptionLines } from "./pacing";
import { parseSearchPlan, str } from "./parse";

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** Any public web page (not YouTube). Only http(s) is ever sent to Apify. */
export function isArticleUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && !isYouTubeUrl(url);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// 1. Understand the request (NLP) and turn it into a search
// -----------------------------------------------------------------------------

export interface SearchPlan {
  query: string;
  /** What the person wants to improve, restated. Empty when Moss isn't available. */
  intent: string;
}

/**
 * "I want to explain technical things as clearly as Feynman" -> a YouTube query
 * plus the intent. Falls back to the person's own words when Moss is unavailable,
 * so searching never depends on the model.
 */
export async function planReferenceSearch(request: string): Promise<SearchPlan> {
  const raw = request.trim().slice(0, 300);
  const system = [
    "Someone wants to improve how they speak and is looking for a public speaker, talk, interview or video to learn from.",
    'Return JSON only: {"query": a YouTube search of at most 8 words that finds a talk or interview with REAL spoken content (name the speaker if they did, add "talk" or "interview"), "intent": one sentence starting with a verb restating what they want to improve}.',
    "Never put quotation marks in the query. Do not invent a speaker the person did not name or clearly imply.",
  ].join("\n");
  const plan = parseSearchPlan(await llmReply(system, [{ role: "user", content: raw }], { temperature: 0.2, maxTokens: 160 }));
  return plan ?? { query: raw.slice(0, 100), intent: "" };
}

// -----------------------------------------------------------------------------
// 2. Search (Apify: YouTube)
// -----------------------------------------------------------------------------

export interface ReferenceCandidate {
  id: string;
  url: string;
  title: string;
  channel: string;
  durationSec?: number;
  views?: number;
}

export type SearchResult =
  | { ok: true; candidates: ReferenceCandidate[] }
  | { ok: false; reason: "empty_query" | "no_results" | "service"; error?: string };

/** "12:34" or "1:02:03" -> seconds. */
export function parseDuration(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const parts = v.trim().split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

export async function searchReferences(query: string): Promise<SearchResult> {
  const q = query.trim().slice(0, 100);
  if (!q) return { ok: false, reason: "empty_query" };
  const res = await runApifyActor({
    actorId: APIFY_SEARCH_ACTOR,
    // hasSubtitles: skip videos with no captions, which would fail at the next step.
    // No shorts/streams: they rarely hold enough speech to learn a style from.
    input: { searchQueries: [q], maxResults: REFERENCE_SEARCH_LIMIT * 2, maxResultsShorts: 0, maxResultStreams: 0, hasSubtitles: true, sortingOrder: "relevance" },
    limit: REFERENCE_SEARCH_LIMIT * 2,
    waitSecs: 60,
  });
  if (!res.ok) return { ok: false, reason: "service", error: res.error };

  const seen = new Set<string>();
  const candidates: ReferenceCandidate[] = [];
  for (const raw of res.items) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const url = str(o.url, 300);
    const id = str(o.id, 40) || url;
    const title = str(o.title, 140);
    const durationSec = parseDuration(o.duration);
    if (!title || !isYouTubeUrl(url) || url.includes("/shorts/") || seen.has(id)) continue;
    if (durationSec !== undefined && durationSec < REFERENCE_MIN_VIDEO_SECONDS) continue;
    seen.add(id);
    const views = Number(o.viewCount);
    candidates.push({ id, url, title, channel: str(o.channelName, 80), ...(durationSec !== undefined ? { durationSec } : {}), ...(Number.isFinite(views) ? { views } : {}) });
    if (candidates.length >= REFERENCE_SEARCH_LIMIT) break;
  }
  return candidates.length ? { ok: true, candidates } : { ok: false, reason: "no_results" };
}

// -----------------------------------------------------------------------------
// 3. Read the reference (Apify: captions or one page)
// -----------------------------------------------------------------------------

export type ReferenceResult =
  | { ok: true; kind: "youtube" | "article"; title?: string; text: string; speech?: SpeechMetrics }
  | { ok: false; reason: "unsupported_url" | "no_transcript" | "no_text" | "service"; error?: string };

/** A page with less text than this is a landing page or a paywall, not something to learn from. */
const MIN_ARTICLE_CHARS = 400;

/** Read a public YouTube video (captions + pacing) or one public web page. */
export async function fetchReference(url: string): Promise<ReferenceResult> {
  if (isYouTubeUrl(url)) return fetchVideo(url);
  if (isArticleUrl(url)) return fetchArticle(url);
  return { ok: false, reason: "unsupported_url" };
}

async function fetchVideo(url: string): Promise<ReferenceResult> {
  const res = await runApifyActor({
    actorId: APIFY_REFERENCE_ACTOR,
    // "json" carries caption timing (for pacing); "llm" is the clean text for the model.
    input: { startUrls: [{ url }], languages: ["en"], subType: "both", outputFormats: ["json", "llm"], enableAiFallback: false },
    limit: 1,
  });
  if (!res.ok) return { ok: false, reason: "service", error: res.error };
  const item = (res.items[0] ?? {}) as {
    transcript_llm?: unknown;
    transcript_text?: unknown;
    transcript_json?: unknown;
    metadata?: { title?: unknown };
    error?: unknown;
  };
  const text = str(item.transcript_llm ?? item.transcript_text, REFERENCE_MAX_CHARS);
  if (!text) return { ok: false, reason: "no_transcript", error: str(item.error, 200) || undefined };
  const speech = computeSpeechMetrics(toCaptionLines(item.transcript_json));
  return { ok: true, kind: "youtube", title: str(item.metadata?.title, 140) || undefined, text, ...(speech ? { speech } : {}) };
}

async function fetchArticle(url: string): Promise<ReferenceResult> {
  const res = await runApifyActor({
    actorId: APIFY_ARTICLE_ACTOR,
    // One page only: depth 0, a single result, plain HTTP (fast, cheap), robots.txt honoured.
    input: {
      startUrls: [{ url }],
      crawlerType: "cheerio",
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
      maxResults: 1,
      saveMarkdown: false,
      respectRobotsTxtFile: true,
      proxyConfiguration: { useApifyProxy: true },
    },
    limit: 1,
    waitSecs: 60,
  });
  if (!res.ok) return { ok: false, reason: "service", error: res.error };
  const item = (res.items[0] ?? {}) as { text?: unknown; metadata?: { title?: unknown } };
  // Collapse whitespace first: str() flattens it, and the minimum should judge real words.
  const text = str(item.text, REFERENCE_MAX_CHARS);
  if (text.length < MIN_ARTICLE_CHARS) return { ok: false, reason: "no_text" };
  return { ok: true, kind: "article", title: str(item.metadata?.title, 140) || undefined, text };
}
