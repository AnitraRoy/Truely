/**
 * Renderer-side entry point for Moss / Cartesia / Apify.
 *
 * Calls go to the desktop shell's bridge (window.cueDesktop.services). Under
 * `npm run dev` in a plain browser they go to the Vite dev server's bridge
 * instead (vite.config.ts), which runs the same handlers with the keys held in
 * Node. A production web build has neither, so it reports "desktop_only".
 *
 * Every function here is safe to call anywhere: with no bridge, or with a
 * service unconfigured, it resolves to { ok: false, error } and never throws, so
 * the live coaching loop can never be broken by a network service (PRD 13).
 * Owner: Integration (person 4).
 */
import type {
  ApifyRunRequest,
  ApifyRunResult,
  CartesiaToken,
  ChatMessage,
  DesktopServices,
  LlmChatRequest,
  ServiceName,
  ServiceResult,
  ServiceStatus,
} from "./types";

export type * from "./types";

const NONE: ServiceStatus = { moss: false, cartesia: false, apify: false };

async function post<T>(channel: string, arg?: unknown): Promise<T> {
  const res = await fetch(`/__cue/svc/${channel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Cue-Bridge": "1" },
    body: arg === undefined ? undefined : JSON.stringify(arg),
  });
  if (!res.ok) throw new Error(`dev bridge ${res.status}`);
  return (await res.json()) as T;
}

/** The Vite dev server's bridge. Same channels as electron/preload.cjs. */
const devBridge: DesktopServices = {
  status: () => post("cue:svc:status"),
  llmChat: (req) => post("cue:llm:chat", req),
  cartesiaToken: () => post("cue:cartesia:token"),
  apifyRun: (req) => post("cue:apify:run", req),
};

/** The desktop bridge, the dev-server bridge, or null (production web build, tests). */
export function serviceBridge(): DesktopServices | null {
  const w = globalThis as unknown as { cueDesktop?: { services?: DesktopServices } };
  if (w.cueDesktop?.services) return w.cueDesktop.services;
  return import.meta.env.DEV && import.meta.env.MODE !== "test" ? devBridge : null;
}

const bridge = serviceBridge;

async function guarded<T>(fn: (s: DesktopServices) => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
  const s = bridge();
  if (!s) return { ok: false, error: "desktop_only" };
  try {
    return await fn(s);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "service_error" };
  }
}

/** Which services have credentials configured. All false when there is no bridge. */
export async function getServiceStatus(): Promise<ServiceStatus> {
  const s = bridge();
  if (!s) return NONE;
  try {
    return await s.status();
  } catch {
    return NONE;
  }
}

export async function isServiceAvailable(name: ServiceName): Promise<boolean> {
  return (await getServiceStatus())[name];
}

/** One chat completion through Moss Inference. */
export function llmChat(req: LlmChatRequest): Promise<ServiceResult<{ text: string }>> {
  return guarded((s) => s.llmChat(req));
}

/** Convenience: system prompt + running history -> assistant text, or null on failure. */
export async function llmReply(system: string, history: ChatMessage[], opts: Omit<LlmChatRequest, "messages"> = {}): Promise<string | null> {
  const res = await llmChat({ ...opts, messages: [{ role: "system", content: system }, ...history] });
  return res.ok ? res.text : null;
}

/** Short-lived Cartesia token for opening STT/TTS sockets from the page. */
export function getCartesiaToken(): Promise<ServiceResult<CartesiaToken>> {
  return guarded((s) => s.cartesiaToken());
}

/** Run an allow-listed Apify actor. */
export function runApifyActor(req: ApifyRunRequest): Promise<ServiceResult<ApifyRunResult>> {
  return guarded((s) => s.apifyRun(req));
}
