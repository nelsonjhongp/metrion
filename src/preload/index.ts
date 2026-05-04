import { contextBridge, ipcRenderer } from "electron";
import type {
  ClosingStatusQuery,
  MetrionApi,
  MonthlySaleInput,
  MonthlySaleQuery,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
  SupplierInput,
  SupplierLookupQuery,
  SupplierQuery,
  SupplierUpdateInput,
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
  listSuppliers: (query: SupplierQuery) =>
    ipcRenderer.invoke("suppliers:list", query),
  findSupplierByRuc: (query: SupplierLookupQuery) =>
    ipcRenderer.invoke("suppliers:findByRuc", query),
  createSupplier: (input: SupplierInput) =>
    ipcRenderer.invoke("suppliers:create", input),
  updateSupplier: (input: SupplierUpdateInput) =>
    ipcRenderer.invoke("suppliers:update", input),
  deleteSupplier: (id: number) => ipcRenderer.invoke("suppliers:delete", id),
  getMonthlySale: (query: MonthlySaleQuery) =>
    ipcRenderer.invoke("sales:getMonthly", query),
  saveMonthlySale: (input: MonthlySaleInput) =>
    ipcRenderer.invoke("sales:saveMonthly", input),
};

contextBridge.exposeInMainWorld("metrion", api);
