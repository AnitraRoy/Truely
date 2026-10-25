
import {
  cpSync,
  mkdirSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const wasmSrc = "node_modules/@mediapipe/tasks-vision/wasm";

if (!existsSync(wasmSrc)) {
  throw new Error("MediaPipe WASM files not found. Run npm install first.");
}

mkdirSync("public/models", { recursive: true });
mkdirSync("public/mediapipe", { recursive: true });

const wasmDest = "public/mediapipe/wasm";

if (existsSync(wasmDest)) {
  rmSync(wasmDest, { recursive: true, force: true });
}
cpSync(wasmSrc, wasmDest, { recursive: true });

const modelPath = "public/models/face_landmarker.task";

if (!existsSync(modelPath)) {
  const url =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Model download failed: HTTP ${res.status}`);
  }

  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
}

console.log("Vision assets ready.");
