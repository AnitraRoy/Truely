import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranscriptSegment } from "@/types";
import { buildConversationReport, extractJson, fetchReference, isYouTubeUrl, parseLiveSuggestion, parseReport, parseStyle, parseTurn } from "..";

const g = globalThis as unknown as { cueDesktop?: { services?: Record<string, unknown> } };
afterEach(() => {
  delete g.cueDesktop;
});

const transcript: TranscriptSegment[] = [
  { id: "s1", startMs: 0, endMs: 4000, role: "coach", speaker: "Coach", text: "Tell me about the project." },
  { id: "s2", startMs: 5000, endMs: 20000, role: "you", speaker: "You", text: "So, some background first..." },
];

describe("extractJson", () => {
  it("finds JSON inside prose or code fences, and returns null otherwise", () => {
    expect(extractJson('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });
});

describe("parseTurn", () => {
  it("keeps only known categories and caps suggestions at three", () => {
    const text = JSON.stringify({
      reply: "Try again, leading with the point.",
      suggestions: [
        { category: "clarity", title: "Lead with it", why: "The ask came last." },
        { category: "confidence", title: "Sound sure", why: "Trait judgement, not allowed." },
        { category: "pacing", title: "Pause", why: "a" },
        { category: "structure", title: "One example", why: "b" },
        { category: "warmth", title: "Thank them", why: "c" },
      ],
    });
    const turn = parseTurn(text)!;
    expect(turn.reply).toBe("Try again, leading with the point.");
    expect(turn.suggestions.map((s) => s.category)).toEqual(["clarity", "pacing", "structure"]);
  });

  it("falls back to plain speech when the model ignores the format", () => {
    expect(parseTurn("Good start. Say it again in one sentence.")).toEqual({ reply: "Good start. Say it again in one sentence.", suggestions: [] });
  });
});

describe("evidence rules", () => {
  it("drops report moments that cite a transcript line that doesn't exist", () => {
    const report = parseReport(
      JSON.stringify({
        summary: "You opened with background.",
        strengths: ["Calm pace"],
        moments: [
          { segmentId: "s2", label: "Setup", note: "Background before the point." },
          { segmentId: "invented", label: "Made up", note: "Should never show." },
        ],
      }),
      transcript,
    )!;
    expect(report.moments.map((m) => m.segmentId)).toEqual(["s2"]);
  });

  it("shows a live suggestion only when it cites a real line, and stays quiet otherwise", () => {
    expect(parseLiveSuggestion('{"suggest": false}', transcript)).toBeNull();
    expect(parseLiveSuggestion('{"suggest": true, "segmentId": "nope", "category": "clarity", "title": "Lead"}', transcript)).toBeNull();
    expect(parseLiveSuggestion('{"suggest": true, "segmentId": "s2", "category": "clarity", "title": "Lead with it", "why": "x"}', transcript)?.segmentId).toBe("s2");
  });

  it("never writes a report for a session where the person said nothing", async () => {
    expect(await buildConversationReport({ kind: "voice", profile: null, goals: [], transcript: transcript.slice(0, 1) })).toBeNull();
  });
});

describe("desired style", () => {
  it("parses traits with known categories only", () => {
    const style = parseStyle(
      JSON.stringify({
        intent: "Explain technical work simply.",
        traits: [
          { category: "clarity", name: "Point first", description: "States the conclusion first.", evidence: "The short answer is yes." },
          { category: "charisma", name: "Charm", description: "Not observable." },
        ],
      }),
    )!;
    expect(style.intent).toBe("Explain technical work simply.");
    expect(style.traits).toHaveLength(1);
    expect(style.traits[0].evidence).toBe("The short answer is yes.");
  });

  it("only sends YouTube links to Apify, with the actor's real input shape", async () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/abc")).toBe(true);
    expect(isYouTubeUrl("https://example.com/talk")).toBe(false);
    expect(await fetchReference("https://example.com/talk")).toEqual({ ok: false, reason: "unsupported_url" });

    const apifyRun = vi.fn().mockResolvedValue({ ok: true, items: [{ metadata: { title: "A talk" }, transcript_llm: "Hello there." }], runStatus: "SUCCEEDED" });
    g.cueDesktop = { services: { apifyRun } };
    expect(await fetchReference("https://youtu.be/abc")).toEqual({ ok: true, title: "A talk", text: "Hello there." });
    expect(apifyRun.mock.calls[0][0].input.startUrls).toEqual([{ url: "https://youtu.be/abc" }]);
  });
});
