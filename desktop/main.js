// ============================================================
// REWARDLY — Electron (main)
// Charge l'application Next.js (déployée) dans une fenêtre native.
// L'URL vient de wrapper.config.mjs (source de vérité unique) ou de la
// variable d'environnement WRAPPER_APP_URL.
// ============================================================
const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// Lire l'URL depuis wrapper.config.mjs (dev : ../wrapper.config.mjs ; package : ./wrapper.config.mjs)
function resolveAppUrl() {
  if (process.env.WRAPPER_APP_URL) return process.env.WRAPPER_APP_URL;
  const candidates = [
    path.join(__dirname, "..", "wrapper.config.mjs"),
    path.join(__dirname, "wrapper.config.mjs"),
  ];
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, "utf8");
      const match = text.match(
        /export const APP_URL\s*=\s*process\.env\.WRAPPER_APP_URL\s*\|\|\s*["']([^"']+)["']/
      );
      if (match) return match[1];
    } catch {
      /* fichier suivant */
    }
  }
  return "https://rewardly.website";
}

const APP_URL = resolveAppUrl();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 700,
    title: "Rewardly",
    autoHideMenuBar: true,
    backgroundColor: "#090909",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  // Les liens externes s'ouvrent dans le navigateur ; la navigation interne reste dans l'app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});