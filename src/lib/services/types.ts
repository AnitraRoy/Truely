/**
 * Contracts for the third-party services truely. can use (Moss, Cartesia, Apify).
 * The renderer never holds their keys: calls go through the desktop shell
 * (electron/services.cjs). Outside the desktop app every call resolves to
 * { ok: false, error: "desktop_only" } so screens can show a labelled fallback.
 */
export type ServiceName = "moss" | "cartesia" | "apify";
export type ServiceStatus = Record<ServiceName, boolean>;

export type ServiceResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmChatRequest {
  messages: ChatMessage[];
  /** Moss indexes to ground the answer in. Omit or [] for no retrieval (e.g. an interviewer persona). */
  indexes?: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface CartesiaToken {
  token: string;
  expiresInSeconds: number;
}

export interface ApifyRunRequest {
  /** "user/actor", must be on the main-process allow-list. */
  actorId: string;
  input?: Record<string, unknown>;
  limit?: number;
  /** How long the main process waits for the run (seconds). Clamped to 15-120; default 90. */
  waitSecs?: number;
}

export interface ApifyRunResult {
  items: unknown[];
  runStatus: string;
}

/** Shape of window.cueDesktop.services (electron/preload.cjs). */
export interface DesktopServices {
  status(): Promise<ServiceStatus>;
  llmChat(req: LlmChatRequest): Promise<ServiceResult<{ text: string }>>;
  cartesiaToken(): Promise<ServiceResult<CartesiaToken>>;
  apifyRun(req: ApifyRunRequest): Promise<ServiceResult<ApifyRunResult>>;
}
