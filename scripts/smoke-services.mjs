// Smoke-tests Moss, Cartesia and Apify with the keys in .env.local (or .env).
//   node scripts/smoke-services.mjs [moss|cartesia|apify]   (default: all)
// Uses the same SDK calls as electron/services.cjs, so a pass here means the
// desktop bridge will work. Costs: a few cents of credits at most.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvFile, safeMessage } = require("../electron/services.cjs");
const local = loadEnvFile(path.join(root, ".env.local"));
if (!loadEnvFile(path.join(root, ".env")) && !local) console.log("note: no .env.local or .env found, using process env only");

const only = process.argv[2];
const results = [];
const run = async (name, fn) => {
  if (only && only !== name) return;
  const t0 = performance.now();
  try {
    const detail = await fn();
    results.push([name, "PASS", `${Math.round(performance.now() - t0)} ms`, detail]);
  } catch (err) {
    results.push([name, "FAIL", "", safeMessage(err)]);
  }
};

await run("moss", async () => {
  const { MOSS_PROJECT_ID: id, MOSS_PROJECT_KEY: key } = process.env;
  if (!id || !key) throw new Error("MOSS_PROJECT_ID / MOSS_PROJECT_KEY missing");
  const { MossInference } = await import("@moss-js/moss");
  const client = new MossInference(id, key);
  // Interviewer persona, no retrieval, 4 turns: this is the question that decides
  // whether Moss can be the mock-interview brain.
  const system =
    "You are a friendly but rigorous interviewer for a software engineering internship. Ask ONE question at a time, " +
    "react briefly to the candidate's last answer, then ask a follow-up. Never answer for the candidate.";
  const messages = [{ role: "system", content: system }, { role: "user", content: "Hi, I'm ready to start." }];
  const answers = [
    "I built a React app for tracking bus telemetry and cut load time in half by caching.",
    "Mostly profiling first, then memoizing the expensive selectors.",
    "I would have written tests earlier; a regression cost me a day.",
  ];
  const turns = [];
  for (let i = 0; i <= answers.length; i++) {
    const c = await client.chat.completions.create({ messages, indexes: [], retrieve: false, max_tokens: 200 }, { timeout: 30000 });
    const text = c.choices[0].message.content ?? "";
    turns.push(text.replace(/\s+/g, " ").slice(0, 110));
    messages.push({ role: "assistant", content: text });
    if (i < answers.length) messages.push({ role: "user", content: answers[i] });
  }
  return "\n      " + turns.map((t, i) => `turn ${i + 1}: ${t}`).join("\n      ");
});

await run("cartesia", async () => {
  if (!process.env.CARTESIA_API_KEY) throw new Error("CARTESIA_API_KEY missing");
  const { default: Cartesia, toFile } = await import("@cartesia/cartesia-js");
  const client = new Cartesia({ apiKey: process.env.CARTESIA_API_KEY });
  const { token } = await client.accessToken.create({ expires_in: 60, grants: { stt: true, tts: true } });
  if (!token) throw new Error("no access token returned");
  // Round trip: speak a sentence, then transcribe the audio back.
  const phrase = "Tell me about a time you led a project under a tight deadline.";
  const speech = await client.tts.generate({
    model_id: "sonic-3.6",
    transcript: phrase,
    voice: "a0e99841-438c-4a64-b679-ae501e7d6091",
    output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 16000 },
  });
  const wav = Buffer.from(await speech.arrayBuffer());
  const stt = await client.stt.transcribe({ file: await toFile(wav, "probe.wav", { type: "audio/wav" }), model: "ink-whisper" });
  return `token ok; tts ${wav.length} bytes; stt heard: "${(stt.text ?? "").slice(0, 70)}"`;
});

await run("apify", async () => {
  if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN missing");
  const { ApifyClient } = await import("apify-client");
  const me = await new ApifyClient({ token: process.env.APIFY_TOKEN }).user().get(); // free, no actor run
  return `authenticated as ${me.username}`;
});

for (const [name, status, ms, detail] of results) console.log(`${status === "PASS" ? "PASS" : "FAIL"}  ${name.padEnd(9)} ${ms.padEnd(8)} ${detail}`);
process.exit(results.some((r) => r[1] === "FAIL") ? 1 : 0);
