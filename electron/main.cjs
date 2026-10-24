/**
 * Cue desktop shell (Electron). Owner: App-shell team.
 *
 * Wraps the same Vite app in a desktop window so the live-session cue overlay can
 * do what a browser can't: float above every app and stay out of screen captures.
 * The overlay technique follows OpenCluely's: a frameless, always-on-top window
 * with OS capture exclusion (`setContentProtection`, i.e. WDA_EXCLUDEFROMCAPTURE on
 * Windows, NSWindowSharingNone on macOS; no-op on Linux), kept off the taskbar,
 * with global shortcuts to hide it or let clicks pass through to the app below.
 *
 * The renderer opens the overlay with window.open("about:blank", OVERLAY_NAME), so
 * it shares the page's JS context and React renders into it through a portal
 * (src/components/useFloatingOverlay.ts). The camera stream never leaves the page.
 *
 *   npm run desktop:dev   Vite dev server + Electron
 *   npm run desktop       production build served from dist/ over app://cue
 */
const { app, BrowserWindow, globalShortcut, ipcMain, net, protocol, screen, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEV_URL = process.env.CUE_DEV_URL;
const DIST = path.join(__dirname, "..", "dist");
const APP_ORIGIN = DEV_URL ? new URL(DEV_URL).origin : "app://cue";

const OVERLAY_NAME = "cue-overlay";
const OVERLAY_MARGIN = 24;
/** Paper colour from src/styles/tokens.css, shown only before first paint. */
const PAPER = "#f3eee3";

const SHORTCUTS = {
  toggleHidden: "CommandOrControl+Shift+H",
  toggleClickThrough: "CommandOrControl+Shift+K",
};

/** Capture exclusion only has an effect on Windows and macOS. */
const CONTENT_PROTECTED = process.platform === "win32" || process.platform === "darwin";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let overlay = null;
let clickThrough = false;

protocol.registerSchemesAsPrivileged([
  // secure: getUserMedia and IndexedDB need a secure, standard origin.
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function shortcutLabel(accelerator) {
  return accelerator.replace("CommandOrControl", process.platform === "darwin" ? "Cmd" : "Ctrl");
}

function overlayState() {
  return {
    open: overlay != null,
    hidden: overlay != null && !overlay.isVisible(),
    clickThrough,
    contentProtected: CONTENT_PROTECTED,
    shortcuts: {
      toggleHidden: shortcutLabel(SHORTCUTS.toggleHidden),
      toggleClickThrough: shortcutLabel(SHORTCUTS.toggleClickThrough),
    },
  };
}

function sendOverlayState() {
  mainWindow?.webContents.send("cue:overlay-state", overlayState());
}

function toggleHidden() {
  if (!overlay) return;
  if (overlay.isVisible()) overlay.hide();
  else overlay.showInactive();
  sendOverlayState();
}

function toggleClickThrough() {
  if (!overlay) return;
  clickThrough = !clickThrough;
  // forward: hover still reaches the page, so the overlay can react to it.
  overlay.setIgnoreMouseEvents(clickThrough, { forward: true });
  sendOverlayState();
}

/** Apply the invisible-overlay treatment to the window the renderer just opened. */
function protectOverlay(win) {
  overlay = win;
  clickThrough = false;

  win.setContentProtection(CONTENT_PROTECTED);
  // "screen-saver" sits above full-screen apps and most meeting windows.
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Top-center of the screen Cue is on, clear of most meeting controls (which
  // tend to sit bottom-center or in a corner).
  const { width, height } = win.getBounds();
  const { workArea } = screen.getDisplayMatching(mainWindow?.getBounds() ?? win.getBounds());
  win.setPosition(workArea.x + Math.round((workArea.width - width) / 2), workArea.y + OVERLAY_MARGIN);

  // Shortcuts are system-wide, so hold them only while the overlay exists.
  globalShortcut.register(SHORTCUTS.toggleHidden, toggleHidden);
  globalShortcut.register(SHORTCUTS.toggleClickThrough, toggleClickThrough);

  win.showInactive();

  win.on("closed", () => {
    overlay = null;
    clickThrough = false;
    globalShortcut.unregister(SHORTCUTS.toggleHidden);
    globalShortcut.unregister(SHORTCUTS.toggleClickThrough);
    sendOverlayState();
  });
  sendOverlayState();
}

function isAppUrl(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    title: "Cue",
    backgroundColor: PAPER,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      // The session keeps running while the person is in another app.
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName === OVERLAY_NAME && url === "about:blank") {
      return {
        action: "allow",
        // Size comes from the window.open features the page passes.
        overrideBrowserWindowOptions: {
          minWidth: 280,
          minHeight: 120,
          frame: false,
          // Shown inactive in protectOverlay, so opening never pulls focus from the meeting.
          show: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          minimizable: false,
          maximizable: false,
          fullscreenable: false,
          // Fully transparent at the OS level: the slightly-translucent fill and
          // rounded corners are drawn in CSS (FloatingOverlay/SessionOverlay), so
          // the window itself must have no opaque square behind them.
          transparent: true,
          hasShadow: false,
          webPreferences: { backgroundThrottling: false },
        },
      };
    }
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-create-window", (win, { frameName }) => {
    if (frameName === OVERLAY_NAME) protectOverlay(win);
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(DEV_URL ?? `${APP_ORIGIN}/`);
}

/** Serve dist/ with a single-page-app fallback so BrowserRouter paths resolve. */
function serveDist() {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    const inside = file.startsWith(DIST + path.sep);
    if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
    return net.fetch(pathToFileURL(file).toString());
  });
}

app.whenReady().then(() => {
  if (!DEV_URL) serveDist();

  // Camera only, and only for Cue's own pages.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(permission === "media" && isAppUrl(details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => {
    return permission === "media" && origin === APP_ORIGIN;
  });

  ipcMain.handle("cue:overlay-state", () => overlayState());
  // Fixed target, never a renderer-supplied URL: Settings › Bluetooth & devices › Cameras.
  ipcMain.handle("cue:open-camera-settings", async () => {
    if (process.platform === "win32") await shell.openExternal("ms-settings:camera");
  });

  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
