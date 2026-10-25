import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEAD_RANGE_CALIBRATION } from "@/config/coaching";
import type { HeadPoseSample } from "@/lib/vision";
import { HeadRangePrompt, HeadRangeSteps, useHeadRange, type HeadRangeResult } from "../HeadRangeGuide";
import type { HeadRangeTracker } from "../useHeadPose";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { steps, holdMs, detect } = HEAD_RANGE_CALIBRATION;
const CENTRE = { yaw: 0, pitch: 0.55 };

const pose = (yaw: number, pitch: number, valid = true): HeadPoseSample => ({
  yaw,
  pitch,
  noseX: 0.5,
  noseY: 0.5,
  faceWidth: 0.3,
  box: null,
  quality: valid ? 0.9 : 0,
  valid,
  issue: valid ? null : "no_face",
});
const ready = (sample: HeadPoseSample | null): HeadRangeTracker => ({ status: "ready", sample });

// Poses that satisfy each position, built from the configured thresholds and signs.
const POSES = {
  center: pose(CENTRE.yaw, CENTRE.pitch),
  up: pose(CENTRE.yaw, CENTRE.pitch + detect.pitchUpSign * (detect.pitchDelta + 0.03)),
  down: pose(CENTRE.yaw, CENTRE.pitch - detect.pitchUpSign * (detect.pitchDelta + 0.03)),
  left: pose(CENTRE.yaw + detect.yawLeftSign * (detect.yawDelta + 0.03), CENTRE.pitch),
  right: pose(CENTRE.yaw - detect.yawLeftSign * (detect.yawDelta + 0.03), CENTRE.pitch),
};

function Harness({ tracker, onComplete }: { tracker?: HeadRangeTracker; onComplete: (r: HeadRangeResult) => void }) {
  const range = useHeadRange({ active: true, onComplete, tracker });
  return (
    <>
      <HeadRangePrompt range={range} />
      <HeadRangeSteps range={range} onSkip={() => {}} />
    </>
  );
}

describe("movement-gated head-range calibration", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onComplete.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const show = (tracker?: HeadRangeTracker) => act(() => root.render(<Harness tracker={tracker} onComplete={onComplete} />));
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const current = () => container.querySelector('[aria-current="step"]')?.textContent ?? "";
  const click = (label: string) => act(() => void [...container.querySelectorAll("button")].find((b) => b.textContent === label)!.click());

  it("does not advance a position until the head has actually moved that way", () => {
    show(ready(POSES.center));
    advance(holdMs + 200);
    expect(current()).toContain("Up");

    // Still looking at the screen: nothing happens, however long they wait.
    advance(holdMs * 3);
    expect(current()).toContain("Up");
    expect(container.textContent).toContain("Waiting for you to");

    // Moving the wrong way (down) does not count either.
    show(ready(POSES.down));
    advance(holdMs * 2);
    expect(current()).toContain("Up");

    // The right movement, held, moves on.
    show(ready(POSES.up));
    advance(holdMs + 200);
    expect(current()).toContain("Down");
  });

  it("walks all five positions with real movements, then reports what it measured", () => {
    for (const step of steps) {
      show(ready(POSES[step.direction]));
      advance(holdMs + 200);
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0] as HeadRangeResult;
    expect(result.gated).toBe(true);
    expect(result.neutral).toEqual({ yaw: CENTRE.yaw, pitch: CENTRE.pitch });
    expect(Object.keys(result.held).sort()).toEqual(["down", "left", "right", "up"]);
  });

  it("restarts the hold if the position is lost for longer than the grace period", () => {
    show(ready(POSES.center));
    advance(holdMs + 200);
    show(ready(POSES.up));
    advance(holdMs + 200);
    show(ready(POSES.down));
    advance(holdMs + 200);
    expect(current()).toContain("Left");

    show(ready(POSES.left));
    advance(2000);
    show(ready(POSES.center)); // looked away
    advance(detect.graceMs + 400);
    show(ready(POSES.left));
    advance(2000); // 4s of total time in position, but the hold restarted
    expect(current()).toContain("Left");
    advance(1800);
    expect(current()).toContain("Right");
  });

  it("holds, and says why, while there is no usable face", () => {
    show(ready(pose(0, 0.5, false)));
    advance(holdMs * 3);
    expect(current()).toContain("Centre");
    expect(container.textContent).toContain("Can't see your face");
  });

  it("waits while face tracking starts and falls back to the timer if it is unavailable", () => {
    show({ status: "loading", sample: null });
    advance(holdMs * 3);
    expect(current()).toContain("Centre");
    expect(container.textContent).toContain("Getting face tracking ready");

    show({ status: "unavailable", sample: null });
    advance(holdMs + 200);
    expect(current()).toContain("Up"); // the original timed behaviour
    expect(container.textContent).toContain("runs on a timer");
  });

  it("offers a hint, and lets the person skip one position or the whole part", () => {
    show(ready(POSES.center));
    advance(holdMs + 200);
    expect(container.textContent).not.toContain("Not picking that up yet");
    advance(detect.hintAfterMs + 500);
    expect(container.textContent).toContain("Not picking that up yet");

    click("Skip this position");
    expect(current()).toContain("Down");
    expect(container.textContent).not.toContain("Not picking that up yet");
  });

  it("can skip every position and still finish, without claiming any movement was detected", () => {
    show(ready(POSES.center));
    for (let i = 0; i < steps.length; i++) click("Skip this position");
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0] as HeadRangeResult;
    expect(result.held).toEqual({});
  });

  it("judges up/down/left/right against the fallback centre if the centre position was skipped", () => {
    show(ready(POSES.left));
    click("Skip this position"); // skip centre
    click("Skip this position"); // skip up
    click("Skip this position"); // skip down
    expect(current()).toContain("Left");
    advance(holdMs + 200);
    expect(current()).toContain("Right");
  });
});
