import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileStore } from "@/state/profileStore";
import { StyleProfilePanel } from "..";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const g = globalThis as unknown as { cueDesktop?: unknown };

const Panel = () => (
  <MemoryRouter>
    <StyleProfilePanel onReview={() => {}} />
  </MemoryRouter>
);

let root: Root;
let host: HTMLDivElement;

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const byLabel = <T extends HTMLElement>(text: string) => {
  const label = [...host.querySelectorAll("label")].find((l) => l.textContent?.includes(text));
  return document.getElementById(label?.htmlFor ?? "missing") as T;
};
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
async function type(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const click = (el: HTMLElement) => act(async () => el.click());

const searchItems = [
  { id: "a1", title: "How great talks work", url: "https://www.youtube.com/watch?v=a1", channelName: "Talks", duration: "14:20", viewCount: 5000 },
  { id: "b2", title: "A second talk", url: "https://www.youtube.com/watch?v=b2", channelName: "Talks", duration: "9:10", viewCount: 90 },
];

beforeEach(() => {
  useProfileStore.getState().resetProfile();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete g.cueDesktop;
});

describe("Communication profile: find a reference", () => {
  it("plans a search, lists candidates, reads the one picked, and saves the kept patterns with where they came from", async () => {
    const llmChat = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: '{"query": "great talk explainer", "intent": "Explain ideas simply."}' })
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({ intent: "Explain ideas simply.", traits: [{ category: "clarity", name: "Point first", description: "States the point before the detail." }] }),
      });
    const apifyRun = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, items: searchItems, runStatus: "SUCCEEDED" })
      .mockResolvedValueOnce({ ok: true, items: [{ metadata: { title: "How great talks work" }, transcript_llm: "The short answer is yes." }], runStatus: "SUCCEEDED" });
    g.cueDesktop = { services: { status: async () => ({ moss: true, cartesia: false, apify: true }), llmChat, apifyRun } };

    await act(async () => root.render(<Panel />));
    await settle();

    // Search is the default way in for a first-time visitor.
    expect(host.textContent).toContain("Who or what do you want to sound like?");
    expect(button("Find talks and interviews").disabled).toBe(true);
    await type(byLabel<HTMLTextAreaElement>("Who or what do you want to sound like?"), "explain ideas simply, like a great talk");
    expect(button("Find talks and interviews").disabled).toBe(false);

    await click(button("Find talks and interviews"));
    await settle();
    expect(apifyRun.mock.calls[0][0].input.searchQueries).toEqual(["great talk explainer"]);
    const radios = host.querySelectorAll<HTMLInputElement>('input[name="reference-candidate"]');
    expect(radios).toHaveLength(2);
    expect(host.textContent).toContain("Searched YouTube for");

    // Nothing is read until the person picks one.
    await click(radios[0]);
    await click(button("Analyse reference"));
    await settle();
    await settle();
    expect(apifyRun).toHaveBeenCalledTimes(2);
    expect(apifyRun.mock.calls[1][0].input.startUrls).toEqual([{ url: "https://www.youtube.com/watch?v=a1" }]);
    expect(host.textContent).toContain("Point first");

    await click(button("Save profile"));
    const saved = useProfileStore.getState().communicationProfile!;
    expect(saved.reference).toMatchObject({ source: "youtube", url: "https://www.youtube.com/watch?v=a1", title: "How great talks work", query: "great talk explainer" });
    expect(saved.traits.map((t) => t.name)).toEqual(["Point first"]);
  });

  it("says plainly when nothing was found, and keeps the other ways in available", async () => {
    g.cueDesktop = {
      services: {
        status: async () => ({ moss: true, cartesia: false, apify: true }),
        llmChat: vi.fn().mockResolvedValue({ ok: false, error: "x" }), // planning falls back to the person's words
        apifyRun: vi.fn().mockResolvedValue({ ok: true, items: [], runStatus: "SUCCEEDED" }),
      },
    };
    await act(async () => root.render(<Panel />));
    await settle();
    await type(byLabel<HTMLTextAreaElement>("Who or what do you want to sound like?"), "zzzz");
    await click(button("Find talks and interviews"));
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("No talks with captions turned up");
    expect(host.textContent).toContain("I have a link");
    expect(host.textContent).toContain("Paste text");
  });

  it("accepts a public article link, and rejects things that are not web links", async () => {
    g.cueDesktop = { services: { status: async () => ({ moss: true, cartesia: false, apify: true }) } };
    await act(async () => root.render(<Panel />));
    await settle();
    await click(host.querySelector<HTMLInputElement>('input[value="link"]')!);
    const link = byLabel<HTMLInputElement>("Link to a talk, interview or article");
    await type(link, "https://example.com/essay");
    expect(host.textContent).not.toContain("doesn't look like a web link");
    await type(link, "not a link");
    expect(host.textContent).toContain("doesn't look like a web link");
  });
});
