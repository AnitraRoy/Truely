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
    expect(html).toContain("never uploaded");
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

describe("Overview at /home", () => {
  it("leads with one next step from real state, and no fabricated progress", () => {
    const html = render(<Dashboard />);
    expect(html).toContain("Suggested next");
    expect(html).toContain("Build my profile"); // no desired style yet
    expect(html).toContain("Recent sessions");
    expect(html).toContain('aria-label="Primary"');
    expect(html).not.toMatch(/\d+%|score|streak/i);
    expect(html).not.toContain("Corvus"); // the plate stays on Landing
  });

  it("has a top toolbar with a named home icon, a wordmark to the landing page, and a side toolbar with purposes", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/home"]}>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(html).toMatch(/<a[^>]*aria-label="Cue landing page"[^>]*href="\/"|<a[^>]*href="\/"[^>]*aria-label="Cue landing page"/);
    const top = html.slice(html.indexOf('aria-label="Primary"'), html.indexOf("</nav>"));
    expect(top).toMatch(/aria-label="Home"/);
    expect(top).toContain('aria-current="page"');
    expect(top).toContain("My profile");
    expect(top).toContain("Review sessions");
    const side = html.slice(html.indexOf('aria-label="Tools"'));
    expect(side).toContain("Find your style");
    expect(side).toContain("Pick a speaker you admire and the habits to practise");
    expect(side).toContain("Calibrate camera");
  });
});
