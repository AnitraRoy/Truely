import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../AppShell";
import { BackButton, backFallback } from "../BackButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe("Back button", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const mount = (entries: string[], index: number, ui: JSX.Element) =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={entries} initialIndex={index}>
          <Where />
          {ui}
        </MemoryRouter>,
      ),
    );
  const where = () => container.querySelector('[data-testid="where"]')!.textContent;
  const back = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Back"))!;

  it("returns to the page the person came from", () => {
    mount(["/home", "/profile"], 1, <BackButton fallback="/elsewhere" />);
    act(() => back().click());
    expect(where()).toBe("/home");
  });

  it("goes to the fallback when this page was opened directly", () => {
    mount(["/profile"], 0, <BackButton fallback="/home" />);
    act(() => back().click());
    expect(where()).toBe("/home");
  });

  it("steps back within the page instead of navigating when asked to", () => {
    const onBack = vi.fn();
    mount(["/home", "/calibrate"], 1, <BackButton fallback="/home" onBack={onBack} />);
    act(() => back().click());
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(where()).toBe("/calibrate");
  });

  it("appears at the top of every page in the app shell, and the page can override it", () => {
    mount(
      ["/home", "/reports"],
      1,
      <Routes>
        <Route path="/reports" element={<AppShell>content</AppShell>} />
      </Routes>,
    );
    expect(back()).toBeTruthy();
    act(() => back().click());
    expect(where()).toBe("/home");

    const onBack = vi.fn();
    mount(
      ["/practice/interview"],
      0,
      <AppShell back={{ onBack, label: "Back to setup" }}>content</AppShell>,
    );
    expect(back().textContent).toContain("Back to setup");
    act(() => back().click());
    expect(onBack).toHaveBeenCalled();
  });

  it("falls back to a sensible parent for each page", () => {
    expect(backFallback("/home")).toBe("/");
    expect(backFallback("/reports")).toBe("/home");
    expect(backFallback("/report/voice/abc")).toBe("/reports");
    expect(backFallback("/report/abc")).toBe("/reports");
    expect(backFallback("/profile/style")).toBe("/profile");
    expect(backFallback("/practice/voice")).toBe("/home");
  });
});
