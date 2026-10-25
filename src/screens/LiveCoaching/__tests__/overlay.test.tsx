// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SAMPLE_CUES, CUE_LIBRARY } from "@/config/coaching";
import { getOverlayMode } from "@/components/useFloatingOverlay";
import { SessionOverlay } from "../SessionOverlay";

const noop = () => {};

describe("SessionOverlay", () => {
  it("shows only the cue: no video and no session controls", () => {
    const html = renderToStaticMarkup(
      <SessionOverlay cue={{ id: 0, text: SAMPLE_CUES[0] }} paused={false} onDismiss={noop} />,
    );
    expect(html).toContain(SAMPLE_CUES[0]);
    expect(html).not.toContain("<video");
    expect(html).not.toContain("End session");
    expect(html).not.toContain("Pause coaching");
  });

  it("labels showcase cues as samples and keeps them dismissible", () => {
    const html = renderToStaticMarkup(
      <SessionOverlay cue={{ id: 1, text: SAMPLE_CUES[0] }} paused={false} onDismiss={noop} />,
    );
    expect(html).toContain("sample");
    expect(html).toContain('aria-label="Dismiss cue"');
  });

  it("stays quiet between cues and says when coaching is paused", () => {
    expect(renderToStaticMarkup(<SessionOverlay cue={null} paused={false} onDismiss={noop} />)).toContain("Observing quietly");
    expect(renderToStaticMarkup(<SessionOverlay cue={null} paused onDismiss={noop} />)).toContain("Coaching is paused.");
  });

  it("offers a dock control only when given one (desktop shell)", () => {
    const html = renderToStaticMarkup(<SessionOverlay cue={null} paused={false} onDismiss={noop} draggable onDock={noop} />);
    expect(html).toContain('aria-label="Show cues in the truely. window instead"');
    expect(renderToStaticMarkup(<SessionOverlay cue={null} paused={false} onDismiss={noop} />)).not.toContain("truely. window");
  });
});

describe("SAMPLE_CUES", () => {
  it("comes from the cue library, without duplicates", () => {
    for (const text of Object.values(CUE_LIBRARY)) expect(SAMPLE_CUES).toContain(text);
    expect(new Set(SAMPLE_CUES).size).toBe(SAMPLE_CUES.length);
  });
});

describe("getOverlayMode", () => {
  it("is null where neither the desktop shell nor Document Picture-in-Picture exists", () => {
    expect(getOverlayMode()).toBe(null);
  });
});
