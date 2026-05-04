import { contextBridge, ipcRenderer } from "electron";
import type {
  ClosingStatusQuery,
  MetrionApi,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
} from "../shared/types";

const api: MetrionApi = {
  getContext: () => ipcRenderer.invoke("app:getContext"),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  listBusinessUnits: (profileId: number) =>
    ipcRenderer.invoke("businessUnits:list", profileId),
  getClosingStatus: (query: ClosingStatusQuery) =>
    ipcRenderer.invoke("closings:getStatus", query),
  listPurchases: (query: PurchaseQuery) =>
    ipcRenderer.invoke("purchases:list", query),
  createPurchase: (input: PurchaseInput) =>
    ipcRenderer.invoke("purchases:create", input),
  updatePurchase: (input: PurchaseUpdateInput) =>
    ipcRenderer.invoke("purchases:update", input),
  deletePurchase: (id: number) => ipcRenderer.invoke("purchases:delete", id),
};

contextBridge.exposeInMainWorld("metrion", api);
