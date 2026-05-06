import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { getDatabase } from "./database";
import { registerIpcHandlers } from "./ipc";

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

const preloadPath = path.join(__dirname, "../preload/index.cjs");
const iconPath = path.join(__dirname, "../renderer/assets/metrion-logo-icon.ico");

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 520,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Metrion",
    backgroundColor: "#f6f1e8",
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.setMenuBarVisibility(false);
  splashWindow.center();

  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  loadRenderer(splashWindow, "splash");
}

function createMainWindow(): void {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "Metrion",
    backgroundColor: "#f6f1e8",
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.maximize();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  loadRenderer(mainWindow);
}

function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    const url = hash ? `${process.env.ELECTRON_RENDERER_URL}#${hash}` : process.env.ELECTRON_RENDERER_URL;
    void win.loadURL(url);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"), hash ? { hash } : undefined);
  }
}

app.whenReady()
  .then(() => {
    getDatabase();
    registerIpcHandlers();
    registerWindowIpc();
    createSplashWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createSplashWindow();
      }
    });
  })
  .catch((error) => {
    console.error("Failed to initialize Metrion", error);
    app.quit();
  });

function registerWindowIpc(): void {
  let selectedProfileId: number | null = null;

  ipcMain.handle("app:enter", (_event, profileId: number) => {
    selectedProfileId = profileId;
    (globalThis as Record<string, unknown>).__selectedProfileId = profileId;
    splashWindow?.close();
    createMainWindow();
  });

  ipcMain.handle("app:logout", () => {
    mainWindow?.close();
    createSplashWindow();
  });

  ipcMain.handle("app:getSelectedProfileId", () => {
    return (globalThis as Record<string, unknown>).__selectedProfileId ?? null;
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
