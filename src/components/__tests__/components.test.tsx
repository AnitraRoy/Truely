// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { StatusChip } from "../StatusChip";
import { Timeline } from "../Timeline";

describe("StatusChip", () => {
  it("conveys status with a text label, never colour alone (CLAUDE.md §3)", () => {
    expect(renderToStaticMarkup(<StatusChip status="observing" />)).toContain("Observing");
    expect(renderToStaticMarkup(<StatusChip status="tracking_unavailable" />)).toContain("Tracking limited");
    expect(renderToStaticMarkup(<StatusChip status="paused" />)).toContain("Paused");
  });
});

describe("Timeline", () => {
  it("renders no event markers for an empty session — no fabricated data (CLAUDE.md §5)", () => {
    const html = renderToStaticMarkup(<Timeline startMs={0} durationMs={0} entries={[]} />);
    expect(html).toContain("tracking gap"); // legend is present
    expect(html).not.toContain("aria-pressed"); // but no clickable event markers
  });

  it("places a cue marker with a signal label at the right position", () => {
    const html = renderToStaticMarkup(
      <Timeline
        startMs={1000}
        durationMs={10000}
        entries={[
          {
            timestamp: 6000,
            kind: "cue",
            event: {
              id: "e1",
              timestamp: 6000,
              signal: "head_orientation",
              confidence: 0.9,
              cueText: "…",
            },
          },
        ]}
      />,
    );
    expect(html).toContain("aria-pressed");
    expect(html).toContain("head orientation");
    expect(html).toContain("left:50%"); // (6000-1000)/10000 = 50%
  });
});
