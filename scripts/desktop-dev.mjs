// Starts the Vite dev server, then the Electron shell pointed at it (electron/main.cjs).
import { spawn } from "node:child_process";
import electron from "electron";
import { createServer } from "vite";

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("Vite did not report a local URL");

const env = { ...process.env, CUE_DEV_URL: url };
// Set when launched from another Electron app; it would make Electron run as plain Node.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ["."], { stdio: "inherit", env });
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
