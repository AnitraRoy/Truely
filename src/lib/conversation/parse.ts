/**
 * Defensive parsing of model output. The LLM is asked for JSON, but anything it
 * returns is treated as untrusted text: unknown categories are dropped,
 * strings are trimmed and length-capped, and any reference to a transcript
 * line that doesn't exist is discarded (no evidence → not shown, CLAUDE.md §5).
 */
import { FEEDBACK_CATEGORIES } from "@/config/conversation";
import type { ConversationReport, FeedbackCategory, ReportMoment, StyleTrait, TranscriptSegment } from "@/types";

/** Pull the first JSON object out of a reply that may be wrapped in prose or ``` fences. */
export function extractJson(text: string | null | undefined): unknown {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function category(v: unknown): FeedbackCategory | null {
  const c = str(v, 40).toLowerCase();
  return (FEEDBACK_CATEGORIES as string[]).includes(c) ? (c as FeedbackCategory) : null;
}

function strings(v: unknown, limit: number, max = 240): string[] {
  return arr(v)
    .map((s) => str(s, max))
    .filter(Boolean)
    .slice(0, limit);
}

export interface ParsedSuggestion {
  category: FeedbackCategory;
  title: string;
  explanation: string;
  suggestion?: string;
}

export function parseSuggestions(v: unknown, limit = 3): ParsedSuggestion[] {
  const out: ParsedSuggestion[] = [];
  for (const raw of arr(v)) {
    const o = obj(raw);
    const c = category(o.category);
    const title = str(o.title, 90);
    if (!c || !title) continue;
    const suggestion = str(o.try ?? o.suggestion, 200);
    out.push({ category: c, title, explanation: str(o.why ?? o.explanation, 280), ...(suggestion ? { suggestion } : {}) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Coach / interviewer turn: what to say next plus optional suggestions. */
export function parseTurn(text: string | null): { reply: string; suggestions: ParsedSuggestion[] } | null {
  const json = obj(extractJson(text));
  const reply = str(json.reply, 900);
  if (reply) return { reply, suggestions: parseSuggestions(json.suggestions) };
  // Model ignored the format: treat the whole reply as speech, with no suggestions.
  const plain = str(text, 900);
  return plain ? { reply: plain, suggestions: [] } : null;
}

/** A single live suggestion, tied to a real transcript line or nothing. */
export function parseLiveSuggestion(text: string | null, transcript: TranscriptSegment[]): (ParsedSuggestion & { segmentId: string }) | null {
  const json = obj(extractJson(text));
  if (json.suggest === false) return null;
  const [s] = parseSuggestions([json], 1);
  const segmentId = str(json.segmentId, 40);
  if (!s || !transcript.some((t) => t.id === segmentId)) return null;
  return { ...s, segmentId };
}

export function parseReport(text: string | null, transcript: TranscriptSegment[]): ConversationReport | null {
  const json = obj(extractJson(text));
  const summary = str(json.summary, 600);
  if (!summary) return null;
  const ids = new Set(transcript.map((t) => t.id));
  const moments: ReportMoment[] = arr(json.moments)
    .map((m) => {
      const o = obj(m);
      return { segmentId: str(o.segmentId, 40), label: str(o.label, 60), note: str(o.note, 320) };
    })
    .filter((m) => ids.has(m.segmentId) && m.note)
    .slice(0, 5);
  return {
    summary,
    strengths: strings(json.strengths, 3),
    improvements: strings(json.improvements, 3),
    nextSteps: strings(json.nextSteps, 3),
    moments,
  };
}

export function parseStyle(text: string | null): { intent: string; traits: Omit<StyleTrait, "id" | "keep">[] } | null {
  const json = obj(extractJson(text));
  const traits = arr(json.traits)
    .map((t) => {
      const o = obj(t);
      const c = category(o.category);
      const name = str(o.name, 50);
      const description = str(o.description, 220);
      if (!c || !name || !description) return null;
      const evidence = str(o.evidence, 200);
      return { category: c, name, description, ...(evidence ? { evidence } : {}) };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .slice(0, 6);
  if (traits.length === 0) return null;
  return { intent: str(json.intent, 240), traits };
}
