// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { StatusChip } from "../StatusChip";
import { Timeline } from "../Timeline";

describe("StatusChip", () => {
  it("conveys status with a text label, never color alone (CLAUDE.md §3)", () => {
    expect(renderToStaticMarkup(<StatusChip status="observing" />)).toContain("Observing");
    expect(renderToStaticMarkup(<StatusChip status="tracking_unavailable" />)).toContain("Tracking limited");
    expect(renderToStaticMarkup(<StatusChip status="paused" />)).toContain("Paused");
  });
});

describe("Timeline", () => {
  it("renders no event markers for an empty session — no fabricated data (CLAUDE.md §5)", () => {
    const html = renderToStaticMarkup(<Timeline durationMs={0} items={[]} />);
    expect(html).toContain("tracking gap"); // default legend is present
    expect(html).not.toContain("aria-pressed"); // but no clickable event markers
  });

  it("places a cue marker with a signal label at the right position", () => {
    const html = renderToStaticMarkup(
      <Timeline
        durationMs={10000}
        items={[
          {
            id: "cue-e1",
            kind: "cue",
            startMs: 5000,
            endMs: 5000,
            label: "…",
            signal: "head_orientation",
            eventId: "e1",
          },
        ]}
      />,
    );
    expect(html).toContain("aria-pressed");
    expect(html).toContain("head orientation");
    expect(html).toContain("left:50%"); // 5000/10000 = 50%
  });

  it("draws spans (deviations, tracking gaps) as bars rather than points", () => {
    const html = renderToStaticMarkup(
      <Timeline
        durationMs={10000}
        items={[{ id: "d1", kind: "deviation", startMs: 1000, endMs: 3000, label: "…" }]}
      />,
    );
    expect(html).not.toContain("aria-pressed"); // spans aren't individually selectable
    expect(html).toContain("width:20%"); // (3000-1000)/10000
  });
});
