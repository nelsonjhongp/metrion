import { ipcMain } from "electron";
import type { ClosingStatusQuery } from "../shared/types";
import {
  getAppContext,
  getClosingStatus,
  listBusinessUnits,
  listProfiles,
} from "./database";

export function registerIpcHandlers(): void {
  ipcMain.handle("app:getContext", () => getAppContext());
  ipcMain.handle("profiles:list", () => listProfiles());
  ipcMain.handle("businessUnits:list", (_event, profileId: number) =>
    listBusinessUnits(profileId),
  );
  ipcMain.handle("closings:getStatus", (_event, query: ClosingStatusQuery) =>
    getClosingStatus(query),
  );
}

