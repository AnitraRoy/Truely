/**
 * Renderer-side entry point for Moss / Cartesia / Apify.
 *
 * Every function here is safe to call anywhere: with no desktop bridge, or with a
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

function bridge(): DesktopServices | null {
  const w = globalThis as unknown as { cueDesktop?: { services?: DesktopServices } };
  return w.cueDesktop?.services ?? null;
}

async function guarded<T>(fn: (s: DesktopServices) => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
  const s = bridge();
  if (!s) return { ok: false, error: "desktop_only" };
  try {
    return await fn(s);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "service_error" };
  }
}

/** Which services have credentials configured. All false outside the desktop app. */
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
