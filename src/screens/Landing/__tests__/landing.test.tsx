// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Landing } from "..";
import { Dashboard } from "../../Dashboard";

const render = (el: JSX.Element) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);

describe("Landing", () => {
  const html = render(<Landing />);

  it("leads with the PRD headline and a start action", () => {
    expect(html).toContain("Show up");
    expect(html).toContain("A little better every time.");
    expect(html).toContain("Start a session");
    expect(html).toContain('href="#how"');
  });

  it("states privacy and what Cue won't do, with no fabricated proof", () => {
    expect(html).toContain("Nothing is uploaded");
    expect(html).toContain("Give you a score");
    expect(html).not.toMatch(/\d+%|testimonial|trusted by/i);
  });

  it("uses real artwork with alt text, not coded SVG illustration", () => {
    expect(html).toMatch(/<img[^>]+alt="Hand-coloured engraving of blue jays/);
    expect(html).not.toContain("<svg");
  });

  it("shows a plain masthead, not the app nav, to first-time visitors", () => {
    expect(html).not.toContain('aria-label="Primary"');
  });
});

describe("Dashboard at /home", () => {
  it("sends people who haven't finished setup back to it", () => {
    const html = render(<Dashboard />);
    expect(html).toContain("Continue setup");
    expect(html).toContain("Recent sessions");
    expect(html).not.toContain("Corvus"); // the plate moved to Landing
  });
});
