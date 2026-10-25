// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { clusterMarkers } from "../clusterMarkers";
import { formatClock } from "../time";
import { MarkerLegend } from "../MarkerLegend";
import { PlaybackBar } from "../PlaybackBar";
import type { ReviewMarker, TranscriptSegment } from "../types";
import { TranscriptPanel } from "../TranscriptPanel";

const noop = () => {};

describe("formatClock", () => {
  it("formats m:ss, and h:mm:ss past an hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(90_000)).toBe("1:30");
    expect(formatClock(3_661_000)).toBe("1:01:01");
  });
});

describe("clusterMarkers", () => {
  const markers: ReviewMarker[] = [
    { id: "a", kind: "cue", atMs: 1000, label: "a" },
    { id: "b", kind: "cue", atMs: 1200, label: "b" },
    { id: "c", kind: "observation", atMs: 50_000, label: "c" },
  ];

  it("groups markers within the threshold fraction of the duration", () => {
    const clusters = clusterMarkers(markers, 100_000, 0.02); // 2% of 100s = 2000ms
    expect(clusters).toHaveLength(2);
    expect(clusters[0].markers.map((m) => m.id)).toEqual(["a", "b"]);
    expect(clusters[1].markers.map((m) => m.id)).toEqual(["c"]);
  });

  it("keeps markers separate when they're far enough apart", () => {
    const clusters = clusterMarkers(markers, 100_000, 0.001); // 0.1% of 100s = 100ms
    expect(clusters).toHaveLength(3);
  });

  it("returns [] for no markers", () => {
    expect(clusterMarkers([], 1000)).toEqual([]);
  });
});

describe("MarkerLegend", () => {
  it("labels every marker kind with text, not color alone (CLAUDE.md §3)", () => {
    const html = renderToStaticMarkup(<MarkerLegend />);
    expect(html).toContain("Cue delivered");
    expect(html).toContain("Behavioral observation");
    expect(html).toContain("Highlighted moment");
  });
});

describe("PlaybackBar", () => {
  it("positions a marker proportionally to the recording's duration", () => {
    const html = renderToStaticMarkup(
      <PlaybackBar
        currentMs={0}
        durationMs={600_000}
        markers={[{ id: "m1", kind: "cue", atMs: 150_000, label: "Cue" }]}
        onSeek={noop}
        onMarkerSelect={noop}
      />,
    );
    expect(html).toContain("left:25%"); // 150000 / 600000
  });

  it("renders no markers for an empty session — no fabricated events (CLAUDE.md §5)", () => {
    const html = renderToStaticMarkup(<PlaybackBar currentMs={0} durationMs={60_000} markers={[]} onSeek={noop} onMarkerSelect={noop} />);
    expect(html).not.toContain("aria-label=\"Cue");
  });
});

describe("TranscriptPanel", () => {
  const segments: TranscriptSegment[] = [
    { id: "t1", startMs: 0, endMs: 5000, text: "Hello there." },
    { id: "t2", startMs: 5000, endMs: 10000, text: "Thanks for joining." },
  ];

  it("marks the active segment so it's visually distinguishable from the rest", () => {
    const html = renderToStaticMarkup(
      <TranscriptPanel
        segments={segments}
        activeSegmentId="t2"
        following
        onSelectSegment={noop}
        onResumeFollowing={noop}
        onPauseFollowing={noop}
      />,
    );
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Thanks for joining.");
  });

  it("offers a way back to following once it's paused", () => {
    const html = renderToStaticMarkup(
      <TranscriptPanel
        segments={segments}
        activeSegmentId="t1"
        following={false}
        onSelectSegment={noop}
        onResumeFollowing={noop}
        onPauseFollowing={noop}
      />,
    );
    expect(html).toContain("Follow playback");
  });
});
