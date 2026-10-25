// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/state/history";
import { SessionList } from "../SessionList";
import { formatDuration, plural } from "@/components/format";
import { Reports } from "..";

describe("formatDuration", () => {
  it("uses plain units without false precision", () => {
    expect(formatDuration(42_000)).toBe("42 sec");
    expect(formatDuration(7 * 60_000 + 20_000)).toBe("7 min");
    expect(formatDuration(60 * 60_000)).toBe("1 hr");
    expect(formatDuration(95 * 60_000)).toBe("1 hr 35 min");
  });
  it("pluralizes", () => {
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(3, "session")).toBe("3 sessions");
  });
});

describe("SessionList", () => {
  const base = { startedAt: Date.UTC(2026, 9, 20, 15), categories: [], hasRecording: false, sample: false };
  const entries: HistoryEntry[] = [
    { ...base, id: "b/2", kind: "live", title: "Live coaching", focus: "Head movement awareness", durationMs: 600_000, href: "/report/b%2F2", hasTranscript: false },
    { ...base, id: "i1", kind: "interview", title: "Behavioral interview", focus: "Answer with structure", durationMs: 1_080_000, href: "/report/interview/i1", hasTranscript: true, hasRecording: true },
  ];

  it("renders a real table whose session cell links to the matching report board, with no score", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SessionList entries={entries} />
      </MemoryRouter>,
    );
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('href="/report/b%2F2"');
    expect(html).toContain('href="/report/interview/i1"');
    expect(html).toContain("Head movement awareness");
    expect(html).toContain("Transcript, Recording");
    expect(html).toContain("10 min");
    expect(html).not.toMatch(/score|\d%/i);
  });
});

describe("Reports screen", () => {
  it("never shows a register or fabricated rows before storage answers", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );
    expect(html).toContain("Small moments, worth revisiting.");
    expect(html).not.toContain("<table");
  });
});
