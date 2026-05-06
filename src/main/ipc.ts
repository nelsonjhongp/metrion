import { dialog, ipcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
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
  SupplierInput,
  SupplierDirectoryQuery,
  SupplierLookupQuery,
  SupplierQuery,
  SupplierUpdateInput,
} from "../shared/types";
import {
  applyBackupImport,
  applyImport,
  buildBackupFile,
  closeMonth,
  createBusinessUnit,
  createProfile,
  createPurchase,
  createSupplier,
  deactivateBusinessUnit,
  deleteBusinessUnit,
  deleteProfile,
  deletePurchase,
  deleteSupplier,
  findSupplierByRuc,
  generateMonthlyXlsx,
  generateYearlyXlsx,
  getBackupExportPreview,
  getAppContext,
  getClosingChecklist,
  getClosingStatus,
  getDashboardData,
  getMonthlySale,
  listBusinessUnits,
  listMonthlyPeriods,
  listProfiles,
  listPurchases,
  listSuppliers,
  listSupplierDirectory,
  previewBackupImport,
  parseImportPreview,
  resolveSupplierDirectoryEntry,
  reopenMonth,
  runSupplierNormalizationSweep,
  saveMonthlySale,
  updateBusinessUnit,
  updateProfile,
  updatePurchase,
  updateSupplier,
} from "./database";

export function registerIpcHandlers(): void {
  ipcMain.handle("app:getContext", (_event, preferredProfileId?: number) =>
    getAppContext(preferredProfileId),
  );
  ipcMain.handle("profiles:list", () => listProfiles());
  ipcMain.handle("businessUnits:list", (_event, profileId: number) =>
    listBusinessUnits(profileId),
  );
  ipcMain.handle("closings:getStatus", (_event, query: ClosingStatusQuery) =>
    getClosingStatus(query),
  );
  ipcMain.handle("closings:getChecklist", (_event, query: MonthlyClosingQuery) =>
    getClosingChecklist(query),
  );
  ipcMain.handle("closings:closeMonth", (_event, query: MonthlyClosingQuery) =>
    closeMonth(query),
  );
  ipcMain.handle("closings:reopenMonth", (_event, query: MonthlyClosingQuery) =>
    reopenMonth(query),
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
  ipcMain.handle("suppliers:listDirectory", (_event, query: SupplierDirectoryQuery) =>
    listSupplierDirectory(query),
  );
  ipcMain.handle("suppliers:runNormalizationSweep", (_event, query: SupplierQuery) =>
    runSupplierNormalizationSweep(query),
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
  ipcMain.handle("suppliers:resolveDirectoryEntry", (_event, input: ResolveSupplierDirectoryEntryInput) =>
    resolveSupplierDirectoryEntry(input),
  );
  ipcMain.handle("sales:getMonthly", (_event, query: MonthlySaleQuery) =>
    getMonthlySale(query),
  );
  ipcMain.handle("sales:saveMonthly", (_event, input: MonthlySaleInput) =>
    saveMonthlySale(input),
  );
  ipcMain.handle("app:exportMonthlyXlsx", async (_event, query: ExportMonthlyXlsxQuery) => {
    const result = await dialog.showSaveDialog({
      title: "Exportar a Excel",
      defaultPath: `Metrion_${query.unitName.replace(/\s+/g, "_")}_${query.monthName}_${query.year}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    try {
      const buffer = await generateMonthlyXlsx(query);
      writeFileSync(result.filePath, buffer);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error al exportar",
      };
    }
  });
  ipcMain.handle("periods:listMonthly", (_event, query: MonthlyPeriodsQuery) =>
    listMonthlyPeriods(query),
  );
  ipcMain.handle("dashboard:getData", (_event, query: DashboardQuery) =>
    getDashboardData(query),
  );
  ipcMain.handle("app:exportYearlyXlsx", async (_event, query: ExportYearlyXlsxQuery) => {
    const result = await dialog.showSaveDialog({
      title: "Exportar año a Excel",
      defaultPath: `Metrion_${query.unitName.replace(/\s+/g, "_")}_${query.year}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    try {
      const buffer = await generateYearlyXlsx(query);
      writeFileSync(result.filePath, buffer);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error al exportar",
      };
    }
  });
  ipcMain.handle("app:exportBackupPreview", () => getBackupExportPreview());
  ipcMain.handle("app:exportBackupFile", async (_event, query: ExportBackupFileQuery) => {
    const selectedProfiles = query.profiles.filter((profile) => profile.businessUnitIds.length > 0);
    if (selectedProfiles.length === 0) {
      return { success: false, error: "Selecciona al menos una unidad para exportar." };
    }

    const result = await dialog.showSaveDialog({
      title: "Guardar respaldo de Metrion",
      defaultPath: `metrion-backup-${new Date().toISOString().slice(0, 10)}.metrion-backup.json`,
      filters: [{ name: "Respaldo Metrion", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    try {
      const backup = buildBackupFile(query);
      writeFileSync(result.filePath, JSON.stringify(backup, null, 2), "utf8");
      return {
        success: true,
        filePath: result.filePath,
        exportedProfiles: backup.profiles.length,
        exportedUnits: backup.profiles.reduce((sum, profile) => sum + profile.units.length, 0),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error al exportar el respaldo.",
      };
    }
  });
  ipcMain.handle("app:importPreview", async (_event, query: ImportPreviewQuery) => {
    const result = await dialog.showOpenDialog({
      title: "Seleccionar archivo Excel",
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { sessionId: "", fileName: "", unitName: "", months: [], totalPurchases: 0, totalMonths: 0, warnings: ["Selección cancelada."] };
    }

    try {
      return await parseImportPreview({ ...query, filePath: result.filePaths[0] });
    } catch (error) {
      return {
        sessionId: "", fileName: "", unitName: "", months: [], totalPurchases: 0, totalMonths: 0,
        warnings: [error instanceof Error ? error.message : "Error al leer el archivo."],
      };
    }
  });
  ipcMain.handle("app:importApply", (_event, query: ImportApplyQuery) =>
    applyImport(query),
  );
  ipcMain.handle("app:importBackupPreview", async () => {
    const result = await dialog.showOpenDialog({
      title: "Seleccionar respaldo de Metrion",
      filters: [{ name: "Respaldo Metrion", extensions: ["json"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        sessionId: "",
        fileName: "",
        version: 1,
        mode: "merge",
        profiles: [],
        totals: {
          profilesCreate: 0,
          unitsCreate: 0,
          suppliersDetected: 0,
          purchasesNew: 0,
          purchasesExisting: 0,
          salesNew: 0,
          salesUpdates: 0,
          closingsNew: 0,
          closingsUpdates: 0,
        },
        warnings: ["Selección cancelada."],
      };
    }

    try {
      const filePath = result.filePaths[0];
      const content = readFileSync(filePath, "utf8");
      return previewBackupImport(content, filePath.split(/[/\\]/).pop() ?? "respaldo.json");
    } catch (error) {
      return {
        sessionId: "",
        fileName: "",
        version: 1,
        mode: "merge",
        profiles: [],
        totals: {
          profilesCreate: 0,
          unitsCreate: 0,
          suppliersDetected: 0,
          purchasesNew: 0,
          purchasesExisting: 0,
          salesNew: 0,
          salesUpdates: 0,
          closingsNew: 0,
          closingsUpdates: 0,
        },
        warnings: [error instanceof Error ? error.message : "No se pudo leer el respaldo."],
      };
    }
  });
  ipcMain.handle("app:importBackupApply", (_event, query: ImportBackupApplyQuery) =>
    applyBackupImport(query),
  );
  ipcMain.handle("profiles:create", (_event, input: ProfileInput) =>
    createProfile(input),
  );
  ipcMain.handle("profiles:update", (_event, input: ProfileUpdateInput) =>
    updateProfile(input),
  );
  ipcMain.handle("profiles:delete", (_event, id: number) => {
    deleteProfile(id);
  });
  ipcMain.handle("businessUnits:create", (_event, input: BusinessUnitInput) =>
    createBusinessUnit(input),
  );
  ipcMain.handle("businessUnits:update", (_event, input: BusinessUnitUpdateInput) =>
    updateBusinessUnit(input),
  );
  ipcMain.handle("businessUnits:delete", (_event, id: number) => {
    deleteBusinessUnit(id);
  });
  ipcMain.handle("businessUnits:deactivate", (_event, id: number) => {
    deactivateBusinessUnit(id);
  });
}
