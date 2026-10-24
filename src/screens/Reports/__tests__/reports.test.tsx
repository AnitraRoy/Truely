// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@/types";
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
  const sessions: SessionSummary[] = [
    { id: "b/2", startedAt: Date.UTC(2026, 9, 20, 15), durationMs: 600_000, goal: "head_movement", eventCount: 4, cueCount: 2 },
  ];

  it("renders a real table whose date links to the report, with counts and no score", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SessionList sessions={sessions} />
      </MemoryRouter>,
    );
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('href="/report/b%2F2"');
    expect(html).toContain("Head movement awareness");
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
    expect(html).toContain("Session reports");
    expect(html).not.toContain("<table");
  });
});
