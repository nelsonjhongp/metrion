import { ipcMain } from "electron";
import type {
  ClosingStatusQuery,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
} from "../shared/types";
import {
  createPurchase,
  deletePurchase,
  getAppContext,
  getClosingStatus,
  listBusinessUnits,
  listProfiles,
  listPurchases,
  updatePurchase,
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
  ipcMain.handle("purchases:list", (_event, query: PurchaseQuery) =>
    listPurchases(query),
  );
  ipcMain.handle("purchases:create", (_event, input: PurchaseInput) =>
    createPurchase(input),
  );
  ipcMain.handle("purchases:update", (_event, input: PurchaseUpdateInput) =>
    updatePurchase(input),
  );
  ipcMain.handle("purchases:delete", (_event, id: number) => {
    deletePurchase(id);
  });
}
