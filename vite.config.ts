import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(import.meta.url);

/**
 * Development-only service bridge: the same Moss / Cartesia / Apify handlers the
 * desktop shell registers over IPC (electron/services.cjs), served by the Vite
 * dev server at POST /__cue/svc/<channel>. Keys stay in this Node process and
 * are never bundled; `vite build` output has no bridge at all, so the shipped
 * web app still needs the desktop shell. Only same-origin pages may call it.
 */
function serviceBridge(): Plugin {
  return {
    name: "cue-service-bridge",
    apply: "serve",
    configureServer(server) {
      const { callService, loadServiceEnv } = require("./electron/services.cjs");
      loadServiceEnv(fileURLToPath(new URL(".", import.meta.url)));

      server.middlewares.use("/__cue/svc", (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        // Refuse other sites in the same browser: a cross-origin page could
        // otherwise spend the keys' credits with a simple POST.
        const origin = req.headers.origin;
        const sameOrigin = () => {
          try {
            return !origin || new URL(origin).host === req.headers.host;
          } catch {
            return false;
          }
        };
        if (req.method !== "POST" || req.headers["x-cue-bridge"] !== "1" || !sameOrigin()) {
          return send(403, { ok: false, error: "untrusted_sender" });
        }
        const channel = (req.url ?? "").replace(/^\//, "");
        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 512_000) req.destroy();
        });
        req.on("end", async () => {
          let arg: unknown;
          try {
            arg = raw ? JSON.parse(raw) : undefined;
          } catch {
            return send(400, { ok: false, error: "bad_json" });
          }
          send(200, await callService(channel, arg));
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serviceBridge()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
