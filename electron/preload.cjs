/**
 * The only bridge between the Cue page and the desktop shell (sandboxed preload).
 * Typed for the renderer in src/components/useFloatingOverlay.ts (`CueDesktop`).
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cueDesktop", {
  overlayName: "cue-overlay",
  getOverlayState: () => ipcRenderer.invoke("cue:overlay-state"),
  openCameraSettings: () => ipcRenderer.invoke("cue:open-camera-settings"),
  onOverlayState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("cue:overlay-state", listener);
    return () => ipcRenderer.removeListener("cue:overlay-state", listener);
  },
});
