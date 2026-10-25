/**
 * The only bridge between the Cue page and the desktop shell (sandboxed preload).
 * Typed for the renderer in src/components/useFloatingOverlay.ts (`CueDesktop`).
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cueDesktop", {
  overlayName: "cue-overlay",
  getOverlayState: () => ipcRenderer.invoke("cue:overlay-state"),
  setOverlayPosition: (position) => ipcRenderer.invoke("cue:overlay-position", position),
  openCameraSettings: () => ipcRenderer.invoke("cue:open-camera-settings"),
  // Third-party services; keys stay in the main process (electron/services.cjs).
  services: {
    status: () => ipcRenderer.invoke("cue:svc:status"),
    llmChat: (req) => ipcRenderer.invoke("cue:llm:chat", req),
    cartesiaToken: () => ipcRenderer.invoke("cue:cartesia:token"),
    apifyRun: (req) => ipcRenderer.invoke("cue:apify:run", req),
  },
  onOverlayState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("cue:overlay-state", listener);
    return () => ipcRenderer.removeListener("cue:overlay-state", listener);
  },
});
