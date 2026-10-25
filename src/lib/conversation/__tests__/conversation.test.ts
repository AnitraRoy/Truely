import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranscriptSegment } from "@/types";
import {
  buildConversationReport,
  computeSpeechMetrics,
  extractJson,
  fetchReference,
  isArticleUrl,
  isYouTubeUrl,
  parseDuration,
  parseLiveSuggestion,
  parseReport,
  parseSearchPlan,
  parseStyle,
  parseTurn,
  planReferenceSearch,
  searchReferences,
  toCaptionLines,
} from "..";

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

  it("only sends http(s) links to Apify, and reads YouTube with the actor's real input shape", async () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/abc")).toBe(true);
    expect(isYouTubeUrl("https://example.com/talk")).toBe(false);
    expect(isArticleUrl("https://example.com/talk")).toBe(true);
    expect(isArticleUrl("https://youtu.be/abc")).toBe(false);
    expect(isArticleUrl("file:///etc/passwd")).toBe(false);
    expect(await fetchReference("javascript:alert(1)")).toEqual({ ok: false, reason: "unsupported_url" });

    const apifyRun = vi.fn().mockResolvedValue({ ok: true, items: [{ metadata: { title: "A talk" }, transcript_llm: "Hello there." }], runStatus: "SUCCEEDED" });
    g.cueDesktop = { services: { apifyRun } };
    expect(await fetchReference("https://youtu.be/abc")).toEqual({ ok: true, kind: "youtube", title: "A talk", text: "Hello there." });
    const req = apifyRun.mock.calls[0][0];
    expect(req.actorId).toBe("codepoetry/youtube-transcript-ai-scraper");
    expect(req.input.startUrls).toEqual([{ url: "https://youtu.be/abc" }]);
    expect(req.input.outputFormats).toEqual(["json", "llm"]); // json = caption timing, for pacing
  });
});

describe("reference: articles", () => {
  it("reads one page through the crawler and rejects pages with too little text", async () => {
    const body = "A real paragraph about explaining things clearly. ".repeat(20);
    const apifyRun = vi.fn().mockResolvedValue({ ok: true, items: [{ text: body, metadata: { title: "On clarity" } }], runStatus: "SUCCEEDED" });
    g.cueDesktop = { services: { apifyRun } };
    const res = await fetchReference("https://example.com/essay");
    expect(res).toMatchObject({ ok: true, kind: "article", title: "On clarity" });
    const req = apifyRun.mock.calls[0][0];
    expect(req.actorId).toBe("apify/website-content-crawler");
    expect(req.input).toMatchObject({ startUrls: [{ url: "https://example.com/essay" }], maxCrawlDepth: 0, maxCrawlPages: 1, respectRobotsTxtFile: true });

    apifyRun.mockResolvedValue({ ok: true, items: [{ text: "Sign in to read more." }], runStatus: "SUCCEEDED" });
    expect(await fetchReference("https://example.com/paywalled")).toEqual({ ok: false, reason: "no_text" });
  });
});

describe("reference: search", () => {
  const item = (o: Record<string, unknown>) => ({ id: "v1", title: "A talk", url: "https://www.youtube.com/watch?v=v1", channelName: "TED", duration: "18:04", viewCount: 1000, ...o });

  it("plans a query with Moss, and falls back to the person's own words without it", async () => {
    const llmChat = vi.fn().mockResolvedValue({ ok: true, text: '{"query": "Richard Feynman \\"lecture\\" explaining physics", "intent": "Explain technical ideas simply."}' });
    g.cueDesktop = { services: { llmChat } };
    expect(await planReferenceSearch("explain like Feynman")).toEqual({ query: "Richard Feynman lecture explaining physics", intent: "Explain technical ideas simply." });
    delete g.cueDesktop;
    expect(await planReferenceSearch("  explain like Feynman ")).toEqual({ query: "explain like Feynman", intent: "" });
    expect(parseSearchPlan("not json")).toBeNull();
  });

  it("returns playable candidates only: YouTube, long enough, not shorts, no duplicates, capped", async () => {
    const items = [
      item({}),
      item({}), // duplicate id
      item({ id: "v2", url: "https://www.youtube.com/watch?v=v2", duration: "0:45" }), // too short
      item({ id: "v3", url: "https://www.youtube.com/shorts/v3" }), // a short
      item({ id: "v4", url: "https://evil.example/watch?v=v4" }), // not YouTube
      item({ id: "v5", url: "https://www.youtube.com/watch?v=v5", duration: "1:02:03" }),
      item({ id: "v6", url: "https://www.youtube.com/watch?v=v6" }),
      item({ id: "v7", url: "https://www.youtube.com/watch?v=v7" }),
      item({ id: "v8", url: "https://www.youtube.com/watch?v=v8" }),
      item({ id: "v9", url: "https://www.youtube.com/watch?v=v9" }),
    ];
    const apifyRun = vi.fn().mockResolvedValue({ ok: true, items, runStatus: "SUCCEEDED" });
    g.cueDesktop = { services: { apifyRun } };
    const res = await searchReferences("feynman talk");
    expect(res.ok && res.candidates.map((c) => c.id)).toEqual(["v1", "v5", "v6", "v7", "v8"]);
    expect(res.ok && res.candidates[1].durationSec).toBe(3723);
    const req = apifyRun.mock.calls[0][0];
    expect(req.actorId).toBe("streamers/youtube-scraper");
    expect(req.input).toMatchObject({ searchQueries: ["feynman talk"], hasSubtitles: true, maxResultsShorts: 0, maxResultStreams: 0 });
  });

  it("reports an empty query, no results and a service failure distinctly", async () => {
    expect(await searchReferences("   ")).toEqual({ ok: false, reason: "empty_query" });
    g.cueDesktop = { services: { apifyRun: vi.fn().mockResolvedValue({ ok: true, items: [], runStatus: "SUCCEEDED" }) } };
    expect(await searchReferences("zzz")).toEqual({ ok: false, reason: "no_results" });
    g.cueDesktop = { services: { apifyRun: vi.fn().mockResolvedValue({ ok: false, error: "Apify token is not configured" }) } };
    expect(await searchReferences("zzz")).toMatchObject({ ok: false, reason: "service" });
  });

  it("parses durations", () => {
    expect(parseDuration("12:34")).toBe(754);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("LIVE")).toBeUndefined();
    expect(parseDuration(undefined)).toBeUndefined();
  });
});

describe("pacing from caption timing", () => {
  // 3 minutes of captions: a 4-word line every 1.5 s, with a 4 s gap after every tenth line.
  const lines = Array.from({ length: 100 }, (_, i) => {
    const start = i * 1.5 + Math.floor(i / 10) * 4;
    return { start, end: start + 1.5, text: "one two three four" };
  });

  it("measures words per minute (pauses removed), pauses per minute and the longest pause", () => {
    const m = computeSpeechMetrics(toCaptionLines(lines))!;
    expect(m.pausesPerMinute).toBeGreaterThan(2);
    expect(m.longestPauseSec).toBe(4);
    expect(m.wordsPerMinute).toBeGreaterThan(150);
    expect(m.wordsPerMinute).toBeLessThan(170);
  });

  it("says nothing when there is too little timed speech, and ignores malformed lines", () => {
    expect(computeSpeechMetrics(toCaptionLines(lines.slice(0, 3)))).toBeNull();
    expect(computeSpeechMetrics([])).toBeNull();
    expect(toCaptionLines([{ start: "x", end: 2, text: "a" }, null, { start: 0, end: 1, text: " " }, { start: 0, end: 1, text: "ok" }])).toHaveLength(1);
    expect(toCaptionLines("nope")).toEqual([]);
  });

  it("is attached to video references and left off when captions carry no timing", async () => {
    const timed = { metadata: { title: "T" }, transcript_llm: "Words.", transcript_json: lines };
    g.cueDesktop = { services: { apifyRun: vi.fn().mockResolvedValue({ ok: true, items: [timed], runStatus: "SUCCEEDED" }) } };
    const withSpeech = await fetchReference("https://youtu.be/abc");
    expect(withSpeech.ok && withSpeech.speech?.longestPauseSec).toBe(4);
    g.cueDesktop = { services: { apifyRun: vi.fn().mockResolvedValue({ ok: true, items: [{ ...timed, transcript_json: undefined }], runStatus: "SUCCEEDED" }) } };
    const without = await fetchReference("https://youtu.be/abc");
    expect(without.ok && without.speech).toBeUndefined();
  });
});
