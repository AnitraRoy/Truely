// @vitest-environment node
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HeadRange } from "@/components/HeadRangeGuide";
import { BaselineStep, type BaselinePhase } from "../steps/Baseline";

const noop = () => {};
const render = (phase: BaselinePhase) =>
  renderToStaticMarkup(
    <BaselineStep
      headingRef={createRef()}
      phase={phase}
      cameraLive
      range={{ index: 0, step: { direction: "center", label: "Centre", prompt: "", instruction: "" }, progress: 0, done: false } as unknown as HeadRange}
      onBegin={noop}
      onRangeSkip={noop}
      onDesiredStyle={noop}
      onStartSession={noop}
      onDashboard={noop}
    />,
  );

describe("Baseline step", () => {
  it("never asks the person to speak for a baseline", () => {
    for (const phase of ["setup", "ready"] as const) {
      expect(render(phase)).not.toMatch(/speak naturally|just talk|keep talking|introduce yourself/i);
    }
    expect(render("setup")).toContain("won&#x27;t be asked to talk");
  });

  it("hands off to the desired style once the camera baseline is ready", () => {
    const html = render("ready");
    expect(html).toContain("Your camera baseline is ready.");
    expect(html).toContain("Set your desired style");
  });
});
