import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import { HeadRangePrompt, HeadRangeSteps, useHeadRange } from "../HeadRangeGuide";

// The sequence runs on timers, so this mounts it for real in jsdom with fake timers.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { steps, holdMs } = HEAD_RANGE_CALIBRATION;

function Harness({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const range = useHeadRange({ active, onComplete });
  return (
    <>
      <HeadRangePrompt range={range} />
      <HeadRangeSteps range={range} onSkip={() => {}} />
    </>
  );
}

describe("head-range calibration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const current = () => container.querySelector('[aria-current="step"]')?.textContent ?? "";

  it("walks centre, up, down, left, right and then completes", () => {
    const onComplete = vi.fn();
    act(() => root.render(<Harness active onComplete={onComplete} />));

    for (const step of steps) {
      expect(current()).toContain(step.label);
      expect(container.textContent).toContain(step.prompt);
      expect(container.textContent).toContain(step.instruction);
      advance(holdMs + 100);
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("holds the current position while inactive (camera off)", () => {
    const onComplete = vi.fn();
    act(() => root.render(<Harness active={false} onComplete={onComplete} />));
    advance(holdMs * 3);
    expect(current()).toContain(steps[0].label);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("pauses and resumes from the same position", () => {
    act(() => root.render(<Harness active onComplete={() => {}} />));
    advance(holdMs + 100);
    expect(current()).toContain(steps[1].label);

    const button = (label: string) =>
      [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
    act(() => button("Pause").click());
    advance(holdMs * 2);
    expect(current()).toContain(steps[1].label);
    expect(container.textContent).toContain("Paused");

    act(() => button("Resume").click());
    advance(holdMs + 100);
    expect(current()).toContain(steps[2].label);
  });
});
