/**
 * Third-party service bridge (main process only).
 *
 * Why here: Moss, Apify and Cartesia use secret keys. Nothing in the renderer
 * bundle may contain them, so the renderer asks the main process, which holds
 * the keys, calls the service, and returns plain data. Keys are read from
 * `.env.local` (gitignored) and never sent over IPC.
 *
 *   MOSS_PROJECT_ID / MOSS_PROJECT_KEY   Moss inference + retrieval
 *   CARTESIA_API_KEY                     minted into short-lived renderer tokens
 *   APIFY_TOKEN                          Apify actor runs (allow-listed actors only)
 *   APIFY_ALLOWED_ACTORS                 optional, comma-separated "user/actor" ids
 *
 * Privacy (PRD 4.4): webcam frames never reach this module. Only text the person
 * chose to send (prompts, transcripts, a reference URL) crosses it.
 */
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ACTORS = ["codepoetry/youtube-transcript-ai-scraper"];
const CARTESIA_TOKEN_TTL_S = 600;

/** Minimal .env.local parser so we need no extra dependency. Real env vars win. */
function loadEnvFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return false;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

/** Strip anything key-shaped before an error message crosses into the renderer. */
function safeMessage(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/(key|token|authorization|bearer)\s*[:=]?\s*[\w.\-]{12,}/gi, "$1 [redacted]")
    .slice(0, 300);
}

function status() {
  return {
    moss: Boolean(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY),
    cartesia: Boolean(process.env.CARTESIA_API_KEY),
    apify: Boolean(process.env.APIFY_TOKEN),
  };
}

let mossClient = null;
async function getMoss() {
  if (mossClient) return mossClient;
  const { MossInference } = await import("@moss-js/moss"); // ESM package, loaded lazily
  mossClient = new MossInference(process.env.MOSS_PROJECT_ID, process.env.MOSS_PROJECT_KEY);
  return mossClient;
}

function allowedActors() {
  const fromEnv = (process.env.APIFY_ALLOWED_ACTORS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ACTORS;
}

/**
 * @param {{ isTrustedSender: (event: Electron.IpcMainInvokeEvent) => boolean, envFile?: string }} options
 */
function registerServices({ isTrustedSender, envFile }) {
  const { ipcMain } = require("electron"); // lazy: scripts/smoke-services.mjs imports this file under plain Node
  loadEnvFile(envFile ?? path.join(__dirname, "..", ".env.local"));

  /** Wrap a handler: only Cue's own pages may call it, and failures become { ok: false }. */
  const handle = (channel, fn) =>
    ipcMain.handle(channel, async (event, arg) => {
      if (!isTrustedSender(event)) return { ok: false, error: "untrusted_sender" };
      try {
        return { ok: true, ...(await fn(arg)) };
      } catch (err) {
        return { ok: false, error: safeMessage(err) };
      }
    });

  ipcMain.handle("cue:svc:status", (event) => (isTrustedSender(event) ? status() : { moss: false, cartesia: false, apify: false }));

  // One non-streaming chat completion through the Moss inference gateway.
  // indexes defaults to [] (no retrieval): an interviewer persona must not be
  // polluted with search hits. Pass indexes to ground an answer instead.
  handle("cue:llm:chat", async (req) => {
    if (!status().moss) throw new Error("Moss credentials are not configured (.env.local).");
    if (!req || !Array.isArray(req.messages) || req.messages.length === 0) throw new Error("messages required");
    const client = await getMoss();
    const indexes = Array.isArray(req.indexes) ? req.indexes : [];
    const completion = await client.chat.completions.create(
      {
        messages: req.messages,
        indexes,
        retrieve: indexes.length > 0,
        temperature: req.temperature ?? 0.7,
        max_tokens: Math.min(Number(req.maxTokens) || 400, 1200),
      },
      { timeout: 30000 },
    );
    return { text: completion.choices?.[0]?.message?.content ?? "" };
  });

  // Short-lived, scoped Cartesia token. The renderer opens STT/TTS sockets with
  // it directly, so audio never passes through the main process.
  handle("cue:cartesia:token", async () => {
    if (!status().cartesia) throw new Error("Cartesia API key is not configured (.env.local).");
    const { default: Cartesia } = await import("@cartesia/cartesia-js");
    const client = new Cartesia({ apiKey: process.env.CARTESIA_API_KEY });
    const { token } = await client.accessToken.create({
      expires_in: CARTESIA_TOKEN_TTL_S,
      grants: { stt: true, tts: true },
    });
    return { token, expiresInSeconds: CARTESIA_TOKEN_TTL_S };
  });

  // Run an allow-listed Apify actor and return its dataset items.
  handle("cue:apify:run", async (req) => {
    if (!status().apify) throw new Error("Apify token is not configured (.env.local).");
    if (!req || typeof req.actorId !== "string") throw new Error("actorId required");
    if (!allowedActors().includes(req.actorId)) throw new Error(`Actor not allow-listed: ${req.actorId}`);
    const { ApifyClient } = require("apify-client");
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const run = await client.actor(req.actorId).call(req.input ?? {}, { waitSecs: 90 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: Math.min(Number(req.limit) || 20, 100) });
    return { items, runStatus: run.status };
  });
}

module.exports = { registerServices, loadEnvFile, safeMessage };
