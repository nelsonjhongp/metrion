import { app } from "electron";
import path from "node:path";

function getUserDataRoot(): string {
  return app.getPath("userData");
}

export function getAppDataDir(): string {
  return path.join(getUserDataRoot(), "data");
}

export function getDatabasePath(): string {
  return path.join(getAppDataDir(), "metrion.sqlite");
}
