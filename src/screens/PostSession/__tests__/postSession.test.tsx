import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMemoryStorage } from "@/lib/storage";
import { setStorageForTests } from "@/state/savedData";
import type { Session } from "@/types";
import { PostSession } from "..";

// This screen's effects are async (loading a session from storage), so unlike the
// rest of the app's static-render tests, these mount it for real in jsdom.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION: Session = {
  id: "s1",
  startedAt: Date.UTC(2026, 0, 1, 12),
  endedAt: Date.UTC(2026, 0, 1, 12, 5),
  goal: "camera_engagement",
  status: "ended",
  eventCount: 1,
  cueCount: 1,
  events: [
    {
      id: "e1",
      timestamp: Date.UTC(2026, 0, 1, 12, 1),
      signal: "gaze_direction",
      confidence: 0.9,
      cueText: "Try bringing your gaze back toward the camera.",
      deviationMagnitude: 2.1,
      responseWindowEnd: Date.UTC(2026, 0, 1, 12, 1, 8),
      response: {
        preDeviation: 2.1,
        postMeanDeviation: 1.0,
        postSampleCount: 5,
        windowComplete: true,
        observedChange: "closer_to_baseline",
      },
    },
  ],
  segments: [
    { kind: "deviation", start: Date.UTC(2026, 0, 1, 11, 59, 58), end: Date.UTC(2026, 0, 1, 12, 1), eventId: "e1", signal: "gaze_direction" },
  ],
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("PostSession", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    const storage = createMemoryStorage();
    await storage.saveSession(SESSION);
    setStorageForTests(storage);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setStorageForTests(null);
    container.remove();
  });

  async function renderAt(path: string) {
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/report/:sessionId" element={<PostSession />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it("wires a real saved session into the metrics, timeline and observations — never a score", async () => {
    await renderAt("/report/s1");
    expect(container.textContent).toContain("Camera engagement");
    expect(container.innerHTML).toContain("Try bringing your gaze back toward the camera.");
    expect(container.textContent).not.toMatch(/communication score|quality score|\d+(\.\d+)?\s*\/\s*100/i);
  });

  it("labels the sample video/transcript as a development fixture and can hide it for the honest empty state", async () => {
    await renderAt("/report/s1");
    expect(container.textContent).toContain("Development fixture");

    const hide = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Hide preview")!;
    await act(async () => hide.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("Video isn't recorded");
    expect(container.textContent).not.toContain("Development fixture — sample video");
  });

  it("falls back to a clearly-labeled sample report for an unknown id in dev, instead of an error screen", async () => {
    await renderAt("/report/does-not-exist");
    expect(container.textContent).toContain("Development preview");
    expect(container.textContent).not.toContain("Session not found");
  });

  it("still shows the honest not-found state for an unknown id outside development", async () => {
    vi.stubEnv("DEV", false);
    try {
      await renderAt("/report/does-not-exist");
      expect(container.textContent).toContain("Session not found");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
