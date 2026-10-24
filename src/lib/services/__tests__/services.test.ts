import { afterEach, describe, expect, it, vi } from "vitest";
import { getCartesiaToken, getServiceStatus, isServiceAvailable, llmChat, llmReply, runApifyActor } from "..";
import type { DesktopServices } from "../types";

const g = globalThis as unknown as { cueDesktop?: { services?: Partial<DesktopServices> } };
afterEach(() => {
  delete g.cueDesktop;
});

describe("services without the desktop bridge", () => {
  it("reports everything unavailable and never throws", async () => {
    expect(await getServiceStatus()).toEqual({ moss: false, cartesia: false, apify: false });
    expect(await isServiceAvailable("moss")).toBe(false);
    expect(await llmChat({ messages: [{ role: "user", content: "hi" }] })).toEqual({ ok: false, error: "desktop_only" });
    expect(await getCartesiaToken()).toEqual({ ok: false, error: "desktop_only" });
    expect(await runApifyActor({ actorId: "a/b" })).toEqual({ ok: false, error: "desktop_only" });
    expect(await llmReply("sys", [])).toBeNull();
  });
});

describe("services with a bridge", () => {
  it("passes the system prompt first and returns the reply text", async () => {
    const llmChatMock = vi.fn().mockResolvedValue({ ok: true, text: "Tell me about yourself." });
    g.cueDesktop = { services: { llmChat: llmChatMock } };
    const text = await llmReply("You are an interviewer.", [{ role: "user", content: "Ready." }], { maxTokens: 100 });
    expect(text).toBe("Tell me about yourself.");
    expect(llmChatMock).toHaveBeenCalledWith({
      maxTokens: 100,
      messages: [
        { role: "system", content: "You are an interviewer." },
        { role: "user", content: "Ready." },
      ],
    });
  });

  it("turns a rejected bridge call into { ok: false } instead of throwing", async () => {
    g.cueDesktop = { services: { cartesiaToken: vi.fn().mockRejectedValue(new Error("ipc closed")) } };
    expect(await getCartesiaToken()).toEqual({ ok: false, error: "ipc closed" });
  });

  it("surfaces configured services", async () => {
    g.cueDesktop = { services: { status: vi.fn().mockResolvedValue({ moss: true, cartesia: false, apify: true }) } };
    expect(await isServiceAvailable("moss")).toBe(true);
    expect(await isServiceAvailable("cartesia")).toBe(false);
  });
});
