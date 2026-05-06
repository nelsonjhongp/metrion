import { contextBridge, ipcRenderer } from "electron";
import type {
  BusinessUnitInput,
  BusinessUnitUpdateInput,
  ClosingStatusQuery,
  DashboardQuery,
  ExportBackupFileQuery,
  ExportMonthlyXlsxQuery,
  ExportYearlyXlsxQuery,
  ImportBackupApplyQuery,
  ImportApplyQuery,
  ImportPreviewQuery,
  MetrionApi,
  MonthlyClosingQuery,
  MonthlyPeriodsQuery,
  MonthlySaleInput,
  MonthlySaleQuery,
  ProfileInput,
  ProfileUpdateInput,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
  ResolveSupplierDirectoryEntryInput,
  Supplier,
  SupplierInput,
  SupplierNormalizationSweepResult,
  SupplierDirectoryEntry,
  SupplierDirectoryQuery,
  SupplierLookupQuery,
  SupplierQuery,
  SupplierUpdateInput,
} from "../shared/types";

function mapSuppliersToDirectoryEntries(suppliers: Supplier[]): SupplierDirectoryEntry[] {
  return suppliers.map((supplier) => ({
    entryKey: `cataloged:${supplier.id}`,
    status: "cataloged",
    supplierId: supplier.id,
    ruc: supplier.ruc,
    name: supplier.name,
    note: supplier.note,
    purchaseCount: 0,
    lastPurchaseDate: null,
    aliases: [supplier.name],
  }));
}

const api: MetrionApi = {
  getContext: (preferredProfileId?: number) =>
    ipcRenderer.invoke("app:getContext", preferredProfileId),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  listBusinessUnits: (profileId: number) =>
    ipcRenderer.invoke("businessUnits:list", profileId),
  getClosingStatus: (query: ClosingStatusQuery) =>
    ipcRenderer.invoke("closings:getStatus", query),
  getClosingChecklist: (query: MonthlyClosingQuery) =>
    ipcRenderer.invoke("closings:getChecklist", query),
  closeMonth: (query: MonthlyClosingQuery) =>
    ipcRenderer.invoke("closings:closeMonth", query),
  reopenMonth: (query: MonthlyClosingQuery) =>
    ipcRenderer.invoke("closings:reopenMonth", query),
  listPurchases: (query: PurchaseQuery) =>
    ipcRenderer.invoke("purchases:list", query),
  createPurchase: (input: PurchaseInput) =>
    ipcRenderer.invoke("purchases:create", input),
  updatePurchase: (input: PurchaseUpdateInput) =>
    ipcRenderer.invoke("purchases:update", input),
  deletePurchase: (id: number) => ipcRenderer.invoke("purchases:delete", id),
  listSuppliers: (query: SupplierQuery) =>
    ipcRenderer.invoke("suppliers:list", query),
  listSupplierDirectory: async (query: SupplierDirectoryQuery) => {
    try {
      return await ipcRenderer.invoke("suppliers:listDirectory", query);
    } catch (error) {
      if (error instanceof Error && error.message.includes("No handler registered")) {
        const suppliers = await ipcRenderer.invoke("suppliers:list", query) as Supplier[];
        return mapSuppliersToDirectoryEntries(suppliers);
      }
      throw error;
    }
  },
  runSupplierNormalizationSweep: (query: SupplierQuery): Promise<SupplierNormalizationSweepResult> =>
    ipcRenderer.invoke("suppliers:runNormalizationSweep", query),
  findSupplierByRuc: (query: SupplierLookupQuery) =>
    ipcRenderer.invoke("suppliers:findByRuc", query),
  createSupplier: (input: SupplierInput) =>
    ipcRenderer.invoke("suppliers:create", input),
  updateSupplier: (input: SupplierUpdateInput) =>
    ipcRenderer.invoke("suppliers:update", input),
  deleteSupplier: (id: number) => ipcRenderer.invoke("suppliers:delete", id),
  resolveSupplierDirectoryEntry: async (input: ResolveSupplierDirectoryEntryInput) => {
    try {
      return await ipcRenderer.invoke("suppliers:resolveDirectoryEntry", input);
    } catch (error) {
      if (error instanceof Error && error.message.includes("No handler registered")) {
        throw new Error("Reinicia la app para terminar de cargar la normalización de proveedores.");
      }
      throw error;
    }
  },
  getMonthlySale: (query: MonthlySaleQuery) =>
    ipcRenderer.invoke("sales:getMonthly", query),
  saveMonthlySale: (input: MonthlySaleInput) =>
    ipcRenderer.invoke("sales:saveMonthly", input),
  exportMonthlyXlsx: (query: ExportMonthlyXlsxQuery) =>
    ipcRenderer.invoke("app:exportMonthlyXlsx", query),
  exportYearlyXlsx: (query: ExportYearlyXlsxQuery) =>
    ipcRenderer.invoke("app:exportYearlyXlsx", query),
  exportBackupPreview: () => ipcRenderer.invoke("app:exportBackupPreview"),
  exportBackupFile: (query: ExportBackupFileQuery) =>
    ipcRenderer.invoke("app:exportBackupFile", query),
  importPreview: (query: ImportPreviewQuery) =>
    ipcRenderer.invoke("app:importPreview", query),
  importApply: (query: ImportApplyQuery) =>
    ipcRenderer.invoke("app:importApply", query),
  importBackupPreview: () => ipcRenderer.invoke("app:importBackupPreview"),
  importBackupApply: (query: ImportBackupApplyQuery) =>
    ipcRenderer.invoke("app:importBackupApply", query),
  createProfile: (input: ProfileInput) =>
    ipcRenderer.invoke("profiles:create", input),
  updateProfile: (input: ProfileUpdateInput) =>
    ipcRenderer.invoke("profiles:update", input),
  deleteProfile: (id: number) => ipcRenderer.invoke("profiles:delete", id),
  createBusinessUnit: (input: BusinessUnitInput) =>
    ipcRenderer.invoke("businessUnits:create", input),
  updateBusinessUnit: (input: BusinessUnitUpdateInput) =>
    ipcRenderer.invoke("businessUnits:update", input),
  deleteBusinessUnit: (id: number) => ipcRenderer.invoke("businessUnits:delete", id),
  deactivateBusinessUnit: (id: number) => ipcRenderer.invoke("businessUnits:deactivate", id),
  enterApp: (profileId: number) => ipcRenderer.invoke("app:enter", profileId),
  logoutApp: () => ipcRenderer.invoke("app:logout"),
  listMonthlyPeriods: (query: MonthlyPeriodsQuery) =>
    ipcRenderer.invoke("periods:listMonthly", query),
  getDashboardData: (query: DashboardQuery) =>
    ipcRenderer.invoke("dashboard:getData", query),
};

contextBridge.exposeInMainWorld("metrion", api);
