// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { SiteNav } from "../SiteNav";
import { Stepper } from "../Stepper";
import { Tabs } from "../Tabs";
import { Toggle } from "../Toggle";
import { SettingRow } from "../SettingRow";
import { ConfirmDialog } from "../ConfirmDialog";
import { PrivacyNote, DEFAULT_PRIVACY_COPY } from "../PrivacyNote";
import { EmptyState } from "../EmptyState";
import { FeedbackGroup } from "../FeedbackGroup";
import { GoalPicker } from "../GoalPicker";
import { applyTheme } from "../../styles/theme";

const noop = () => {};

describe("SiteNav", () => {
  it("renders labelled text links and marks the current page", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/profile"]}>
        <SiteNav />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain("Profile");
    expect(html).toMatch(/href="\/profile"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/profile"/);
  });

  it("links Home to the landing page, not the signed-in dashboard", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/profile"]}>
        <SiteNav />
      </MemoryRouter>,
    );
    expect(html).toMatch(/href="\/"[^>]*>Home</);
    expect(html).not.toMatch(/href="\/"[^>]*aria-current="page"/); // not marked current on another page
  });
});

describe("Stepper", () => {
  it("states progress in words, not colour alone", () => {
    const html = renderToStaticMarkup(<Stepper steps={["Welcome", "Goal", "Camera"]} current={1} />);
    expect(html).toContain("Step 2 of 3: Goal");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Welcome (done)");
  });
});

describe("Tabs", () => {
  it("follows the APG roving-tabindex pattern", () => {
    const html = renderToStaticMarkup(
      <Tabs
        label="Profile"
        value="settings"
        onChange={noop}
        items={[
          { key: "overview", label: "Overview", panel: <p>O</p> },
          { key: "settings", label: "Settings", panel: <p>S-panel</p> },
        ]}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"/);
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"/);
    expect(html).toContain("S-panel");
    expect(html).not.toContain(">O<");
  });
});

describe("Toggle", () => {
  it("is a named switch that spells out its state", () => {
    const on = renderToStaticMarkup(<Toggle checked label="Mute cues" onChange={noop} />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('aria-label="Mute cues"');
    expect(on).toContain(">On<");
    expect(renderToStaticMarkup(<Toggle checked={false} label="x" onChange={noop} />)).toContain(">Off<");
  });
});

describe("SettingRow", () => {
  it("renders label and help with a describable id", () => {
    const html = renderToStaticMarkup(
      <SettingRow label="Theme" help="Light is the default." helpId="theme-help">
        <span>control</span>
      </SettingRow>,
    );
    expect(html).toContain("Theme");
    expect(html).toContain('id="theme-help"');
  });
});

describe("ConfirmDialog", () => {
  it("names what is removed and offers Cancel", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog open={false} title="Delete history?" confirmLabel="Delete" onConfirm={noop} onCancel={noop}>
        All saved sessions will be removed.
      </ConfirmDialog>,
    );
    expect(html).toContain("<dialog");
    expect(html).toContain("All saved sessions will be removed.");
    expect(html).toContain("Cancel");
    expect(html).not.toMatch(/red/);
  });
});

describe("PrivacyNote / EmptyState", () => {
  it("uses the standard privacy copy by default", () => {
    expect(renderToStaticMarkup(<PrivacyNote />)).toContain(DEFAULT_PRIVACY_COPY);
  });
  it("renders an honest empty state without data", () => {
    const html = renderToStaticMarkup(<EmptyState title="No sessions filed yet">Your first run appears here.</EmptyState>);
    expect(html).toContain("No sessions filed yet");
    expect(html).not.toMatch(/\d+%/);
  });
});

describe("FeedbackGroup", () => {
  it("offers the three PRD answers and marks the chosen one with text", () => {
    const html = renderToStaticMarkup(<FeedbackGroup name="e1" value="helpful" onChange={noop} />);
    expect(html).toContain("Was this cue helpful?");
    expect(html).toContain("Not helpful");
    expect(html).toContain("Too distracting");
    expect(html).toContain("✓");
    expect(html).toContain('name="feedback-e1"');
  });
});

describe("GoalPicker", () => {
  it("offers the three goals as native radios and labels the selection in text", () => {
    const html = renderToStaticMarkup(<GoalPicker value="head_movement" onChange={noop} labelledBy="h" />);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain("Head movement awareness");
    expect(html).toContain("selected");
    expect(html).toContain('aria-labelledby="h"');
  });
});

describe("applyTheme", () => {
  it("keeps light as the attribute-free default; dark and system are opt-in", () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
    } as unknown as HTMLElement;
    applyTheme("dark", root);
    expect(attrs.get("data-theme")).toBe("dark");
    applyTheme("light", root);
    expect(attrs.has("data-theme")).toBe(false);
  });
});
