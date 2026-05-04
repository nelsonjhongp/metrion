import { ipcMain } from "electron";
import type {
  ClosingStatusQuery,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
  SupplierInput,
  SupplierLookupQuery,
  SupplierQuery,
  SupplierUpdateInput,
} from "../shared/types";
import {
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  findSupplierByRuc,
  getAppContext,
  getClosingStatus,
  listBusinessUnits,
  listProfiles,
  listPurchases,
  listSuppliers,
  updateSupplier,
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
  ipcMain.handle("suppliers:list", (_event, query: SupplierQuery) =>
    listSuppliers(query),
  );
  ipcMain.handle("suppliers:findByRuc", (_event, query: SupplierLookupQuery) =>
    findSupplierByRuc(query),
  );
  ipcMain.handle("suppliers:create", (_event, input: SupplierInput) =>
    createSupplier(input),
  );
  ipcMain.handle("suppliers:update", (_event, input: SupplierUpdateInput) =>
    updateSupplier(input),
  );
  ipcMain.handle("suppliers:delete", (_event, id: number) => {
    deleteSupplier(id);
  });
}
