import Database from "better-sqlite3";
import { app } from "electron";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import type {
  AppContext,
  BackupImportProfileImpact,
  BackupImportUnitImpact,
  BackupSelectionProfile,
  BusinessUnit,
  ClosingStatus,
  ClosingStatusQuery,
  DashboardData,
  DashboardQuery,
  DashboardSeriesPoint,
  DashboardSupplierRankingItem,
  ExportBackupFileQuery,
  ExportBackupPreview,
  ExportMonthlyXlsxQuery,
  ExportYearlyXlsxQuery,
  ImportBackupApplyQuery,
  ImportBackupApplyResult,
  ImportBackupPreview,
  ImportApplyQuery,
  ImportApplyResult,
  ImportMonthPreview,
  ImportPreview,
  ImportPreviewQuery,
  MonthlyClosing,
  MonthlyClosingChecklist,
  MonthlyClosingQuery,
  MonthlyPeriodsQuery,
  MonthlyPeriodSummary,
  MonthlySale,
  MonthlySaleInput,
  MonthlySaleQuery,
  MonthlyPurchases,
  Profile,
  Purchase,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
  Supplier,
  SupplierDirectoryEntry,
  SupplierInput,
  SupplierDirectoryQuery,
  SupplierLookupQuery,
  SupplierNormalizationSweepResult,
  SupplierQuery,
  SupplierUpdateInput,
  ResolveSupplierDirectoryEntryInput,
} from "../shared/types";
import {
  monthlySaleInputSchema,
  monthlySaleQuerySchema,
} from "../shared/sales-validation";
import {
  purchaseInputSchema,
  purchaseQuerySchema,
  purchaseUpdateInputSchema,
} from "../shared/purchase-validation";
import {
  supplierInputSchema,
  supplierLookupQuerySchema,
  supplierQuerySchema,
  supplierUpdateInputSchema,
} from "../shared/supplier-validation";
import { calculateMonthlySummary } from "../shared/monthly-calculations";

const seedUnits = [
  "UNIT_A",
  "UNIT_B",
  "UNIT_C",
];

const MONTH_LABELS_SHORT = [
  "",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Oct",
  "Nov",
  "Dic",
];

let database: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  database = new Database(path.join(dataDir, "metrion.sqlite"));
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  migrate(database);
  seed(database);
  recoverData(database);

  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = null;
}

export function listProfiles(): Profile[] {
  return getDatabase()
    .prepare<[], { id: number; name: string }>(
      "SELECT id, name FROM profiles ORDER BY name",
    )
    .all();
}

export function listBusinessUnits(profileId: number): BusinessUnit[] {
  return getDatabase()
    .prepare<[number], BusinessUnitRow>(
      `SELECT id, profile_id, name, is_active
       FROM business_units
       WHERE profile_id = ? AND is_active = 1
       ORDER BY id`,
    )
    .all(profileId)
    .map(mapBusinessUnit);
}

export function getClosingStatus(query: ClosingStatusQuery): ClosingStatus {
  const row = getDatabase()
    .prepare<
      [number, number, number, number],
      { is_closed: number } | undefined
    >(
      `SELECT is_closed
       FROM monthly_closings
       WHERE profile_id = ?
         AND business_unit_id = ?
         AND period_month = ?
         AND period_year = ?`,
    )
    .get(query.profileId, query.businessUnitId, query.month, query.year);

  return row?.is_closed ? "closed" : "open";
}

export function getClosingChecklist(
  query: MonthlyClosingQuery,
): MonthlyClosingChecklist {
  const safeQuery = monthlySaleQuerySchema.parse(query);
  const db = getDatabase();
  const purchaseCount =
    db
      .prepare<[number, number, number, number], { count: number }>(
        `SELECT COUNT(*) AS count
         FROM purchases
         WHERE profile_id = ?
           AND business_unit_id = ?
           AND period_month = ?
           AND period_year = ?`,
      )
      .get(
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.month,
        safeQuery.year,
      )?.count ?? 0;
  const salesCount =
    db
      .prepare<[number, number, number, number], { count: number }>(
        `SELECT COUNT(*) AS count
         FROM monthly_sales
         WHERE profile_id = ?
           AND business_unit_id = ?
           AND period_month = ?
           AND period_year = ?`,
      )
      .get(
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.month,
        safeQuery.year,
      )?.count ?? 0;

  return {
    hasPurchases: purchaseCount > 0,
    hasSales: salesCount > 0,
    status: getClosingStatus(safeQuery),
  };
}

export function closeMonth(query: MonthlyClosingQuery): MonthlyClosing {
  const safeQuery = monthlySaleQuerySchema.parse(query);

  getDatabase()
    .prepare(
      `INSERT INTO monthly_closings (
         profile_id,
         business_unit_id,
         period_month,
         period_year,
         is_closed,
         closed_at,
         reopened_at
       ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, NULL)
       ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
       DO UPDATE SET
         is_closed = 1,
         closed_at = CURRENT_TIMESTAMP,
         reopened_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.month,
      safeQuery.year,
    );

  return getMonthlyClosing(safeQuery);
}

export function reopenMonth(query: MonthlyClosingQuery): MonthlyClosing {
  const safeQuery = monthlySaleQuerySchema.parse(query);

  getDatabase()
    .prepare(
      `INSERT INTO monthly_closings (
         profile_id,
         business_unit_id,
         period_month,
         period_year,
         is_closed,
         reopened_at
       ) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
       ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
       DO UPDATE SET
         is_closed = 0,
         reopened_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.month,
      safeQuery.year,
    );

  return getMonthlyClosing(safeQuery);
}

export function listPurchases(query: PurchaseQuery): MonthlyPurchases {
  const safeQuery = purchaseQuerySchema.parse(query);
  const db = getDatabase();
  const rows = db
    .prepare<[number, number, number, number], PurchaseRow>(
      `SELECT id,
              profile_id,
              business_unit_id,
              supplier_id,
              period_month,
              period_year,
              purchase_date,
              ruc,
              supplier_name,
              invoice_number,
              amount,
              payment,
              note,
              created_at,
              updated_at
       FROM purchases
       WHERE profile_id = ?
         AND business_unit_id = ?
         AND period_month = ?
         AND period_year = ?
       ORDER BY purchase_date DESC, id DESC`,
    )
    .all(
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.month,
      safeQuery.year,
    )
    .map(mapPurchase);

  const totalAmount = db
    .prepare<
      [number, number, number, number],
      { total_amount: number | null }
    >(
      `SELECT COALESCE(SUM(amount), 0) AS total_amount
       FROM purchases
       WHERE profile_id = ?
         AND business_unit_id = ?
         AND period_month = ?
         AND period_year = ?`,
    )
    .get(
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.month,
      safeQuery.year,
    )?.total_amount ?? 0;

  return { rows, totalAmount };
}

export function createPurchase(input: PurchaseInput): Purchase {
  const safeInput = purchaseInputSchema.parse(input);
  assertPeriodOpen(safeInput);

  const result = getDatabase()
    .prepare(
      `INSERT INTO purchases (
         profile_id,
         business_unit_id,
         supplier_id,
         period_month,
         period_year,
         purchase_date,
         ruc,
         supplier_name,
         invoice_number,
         amount,
         payment,
         note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      safeInput.profileId,
      safeInput.businessUnitId,
      safeInput.supplierId ?? null,
      safeInput.month,
      safeInput.year,
      safeInput.purchaseDate,
      safeInput.ruc ?? null,
      safeInput.supplierName,
      safeInput.invoiceNumber ?? null,
      safeInput.amount,
      safeInput.payment ?? null,
      safeInput.note ?? null,
    );

  return getPurchaseById(Number(result.lastInsertRowid));
}

export function updatePurchase(input: PurchaseUpdateInput): Purchase {
  const safeInput = purchaseUpdateInputSchema.parse(input);
  const currentPurchase = getPurchaseById(safeInput.id);
  assertPeriodOpen({
    profileId: currentPurchase.profileId,
    businessUnitId: currentPurchase.businessUnitId,
    month: currentPurchase.periodMonth,
    year: currentPurchase.periodYear,
  });
  assertPeriodOpen(safeInput);

  const result = getDatabase()
    .prepare(
      `UPDATE purchases
       SET profile_id = ?,
           business_unit_id = ?,
           supplier_id = ?,
           period_month = ?,
           period_year = ?,
           purchase_date = ?,
           ruc = ?,
           supplier_name = ?,
           invoice_number = ?,
           amount = ?,
           payment = ?,
           note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(
      safeInput.profileId,
      safeInput.businessUnitId,
      safeInput.supplierId ?? null,
      safeInput.month,
      safeInput.year,
      safeInput.purchaseDate,
      safeInput.ruc ?? null,
      safeInput.supplierName,
      safeInput.invoiceNumber ?? null,
      safeInput.amount,
      safeInput.payment ?? null,
      safeInput.note ?? null,
      safeInput.id,
    );

  if (result.changes === 0) {
    throw new Error("Compra no encontrada.");
  }

  return getPurchaseById(safeInput.id);
}

export function deletePurchase(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Compra invalida.");
  }

  const purchase = getPurchaseById(id);
  assertPeriodOpen({
    profileId: purchase.profileId,
    businessUnitId: purchase.businessUnitId,
    month: purchase.periodMonth,
    year: purchase.periodYear,
  });

  getDatabase().prepare("DELETE FROM purchases WHERE id = ?").run(id);
}

export function listSuppliers(query: SupplierQuery): Supplier[] {
  const safeQuery = supplierQuerySchema.parse(query);
  const db = getDatabase();
  reconcileSupplierReferences(db, safeQuery.profileId);

  return db
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE profile_id = ?
       ORDER BY LOWER(name) ASC, COALESCE(ruc, '') ASC`,
    )
    .all(safeQuery.profileId)
    .map(mapSupplier);
}

export function listSupplierDirectory(query: SupplierDirectoryQuery): SupplierDirectoryEntry[] {
  const safeQuery = supplierQuerySchema.parse(query);
  const db = getDatabase();
  reconcileSupplierReferences(db, safeQuery.profileId);

  const suppliers = db
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE profile_id = ?
       ORDER BY LOWER(name) ASC, COALESCE(ruc, '') ASC`,
    )
    .all(safeQuery.profileId)
    .map(mapSupplier);

  const purchaseStats = new Map<number, { purchaseCount: number; lastPurchaseDate: string | null }>();
  for (const row of db
    .prepare<[number], { supplier_id: number; purchase_count: number; last_purchase_date: string | null }>(
      `SELECT supplier_id, COUNT(*) AS purchase_count, MAX(purchase_date) AS last_purchase_date
       FROM purchases
       WHERE profile_id = ? AND supplier_id IS NOT NULL
       GROUP BY supplier_id`,
    )
    .all(safeQuery.profileId)) {
    purchaseStats.set(row.supplier_id, {
      purchaseCount: row.purchase_count,
      lastPurchaseDate: row.last_purchase_date,
    });
  }

  const cataloged = suppliers.map<SupplierDirectoryEntry>((supplier) => {
    const stats = purchaseStats.get(supplier.id);
    return {
      entryKey: `cataloged:${supplier.id}`,
      status: "cataloged",
      supplierId: supplier.id,
      ruc: supplier.ruc,
      name: supplier.name,
      note: supplier.note,
      purchaseCount: stats?.purchaseCount ?? 0,
      lastPurchaseDate: stats?.lastPurchaseDate ?? null,
      aliases: [supplier.name],
    };
  });

  const pendingGroups = new Map<string, SupplierDirectoryEntry>();
  const unresolvedPurchases = db
    .prepare<[number], { ruc: string | null; supplier_name: string; purchase_date: string }>(
      `SELECT ruc, supplier_name, purchase_date
       FROM purchases
       WHERE profile_id = ? AND supplier_id IS NULL
       ORDER BY purchase_date DESC`,
    )
    .all(safeQuery.profileId);

  for (const purchase of unresolvedPurchases) {
    const entryKey = buildSupplierDirectoryKey(purchase.ruc, purchase.supplier_name);
    if (!entryKey) continue;

    const current = pendingGroups.get(entryKey);
    if (!current) {
      pendingGroups.set(entryKey, {
        entryKey,
        status: "pending",
        supplierId: null,
        ruc: normalizeNullableText(purchase.ruc),
        name: purchase.supplier_name.trim(),
        note: null,
        purchaseCount: 1,
        lastPurchaseDate: purchase.purchase_date,
        aliases: [purchase.supplier_name.trim()],
      });
      continue;
    }

    current.purchaseCount += 1;
    if (purchase.purchase_date > (current.lastPurchaseDate ?? "")) {
      current.lastPurchaseDate = purchase.purchase_date;
      current.name = purchase.supplier_name.trim();
    }
    if (!current.ruc) {
      current.ruc = normalizeNullableText(purchase.ruc);
    }
    if (!current.aliases.includes(purchase.supplier_name.trim())) {
      current.aliases.push(purchase.supplier_name.trim());
    }
  }

  return [
    ...Array.from(pendingGroups.values()).sort((a, b) => a.name.localeCompare(b.name, "es")),
    ...cataloged,
  ];
}

export function findSupplierByRuc(query: SupplierLookupQuery): Supplier | null {
  const safeQuery = supplierLookupQuerySchema.parse(query);
  const row = getDatabase()
    .prepare<[number, string], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE profile_id = ? AND ruc = ?`,
    )
    .get(safeQuery.profileId, safeQuery.ruc);

  return row ? mapSupplier(row) : null;
}

export function createSupplier(input: SupplierInput): Supplier {
  const safeInput = supplierInputSchema.parse(input);
  const db = getDatabase();

  try {
    assertSupplierCatalogUniqueness(db, safeInput.profileId, safeInput.name, safeInput.ruc ?? null);

    const result = db
      .prepare(
        `INSERT INTO suppliers (profile_id, ruc, name, note)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        safeInput.profileId,
        safeInput.ruc,
        safeInput.name,
        safeInput.note ?? null,
      );

    reconcileSupplierReferences(db, safeInput.profileId);
    return getSupplierById(Number(result.lastInsertRowid));
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function updateSupplier(input: SupplierUpdateInput): Supplier {
  const safeInput = supplierUpdateInputSchema.parse(input);
  const db = getDatabase();

  try {
    assertSupplierCatalogUniqueness(
      db,
      safeInput.profileId,
      safeInput.name,
      safeInput.ruc ?? null,
      safeInput.id,
    );

    const result = db
      .prepare(
        `UPDATE suppliers
         SET profile_id = ?,
             ruc = ?,
             name = ?,
             note = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        safeInput.profileId,
        safeInput.ruc,
        safeInput.name,
        safeInput.note ?? null,
        safeInput.id,
      );

    if (result.changes === 0) {
      throw new Error("Proveedor no encontrado.");
    }

    reconcileSupplierReferences(db, safeInput.profileId);
    return getSupplierById(safeInput.id);
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function deleteSupplier(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Proveedor invalido.");
  }

  const result = getDatabase().prepare("DELETE FROM suppliers WHERE id = ?").run(id);

  if (result.changes === 0) {
    throw new Error("Proveedor no encontrado.");
  }
}

export function resolveSupplierDirectoryEntry(input: ResolveSupplierDirectoryEntryInput): Supplier {
  const db = getDatabase();
  const profileId = supplierQuerySchema.parse({ profileId: input.profileId }).profileId;
  reconcileSupplierReferences(db, profileId);

  const pendingEntry = listSupplierDirectory({ profileId }).find(
    (entry) => entry.entryKey === input.entryKey && entry.status === "pending",
  );

  if (!pendingEntry) {
    throw new Error("Proveedor pendiente no encontrado.");
  }

  let targetSupplier: Supplier;
  if (input.targetSupplierId) {
    targetSupplier = getSupplierById(input.targetSupplierId);
    if (targetSupplier.profileId !== profileId) {
      throw new Error("El proveedor seleccionado no pertenece al perfil actual.");
    }
  } else if (input.supplier) {
    targetSupplier = createSupplier({
      profileId,
      name: input.supplier.name,
      ruc: input.supplier.ruc ?? null,
      note: input.supplier.note ?? null,
    });
  } else {
    throw new Error("Selecciona un proveedor o crea uno nuevo.");
  }

  const purchaseIds = db
    .prepare<[number], { id: number; ruc: string | null; supplier_name: string }>(
      `SELECT id, ruc, supplier_name
       FROM purchases
       WHERE profile_id = ? AND supplier_id IS NULL`,
    )
    .all(profileId)
    .filter((purchase) => buildSupplierDirectoryKey(purchase.ruc, purchase.supplier_name) === pendingEntry.entryKey)
    .map((purchase) => purchase.id);

  const updatePurchase = db.prepare(
    `UPDATE purchases
     SET supplier_id = ?,
         supplier_name = ?,
         ruc = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  );

  const nextRuc = targetSupplier.ruc ?? pendingEntry.ruc ?? null;
  db.transaction(() => {
    for (const purchaseId of purchaseIds) {
      updatePurchase.run(targetSupplier.id, targetSupplier.name, nextRuc, purchaseId);
    }
  })();

  reconcileSupplierReferences(db, profileId);
  return getSupplierById(targetSupplier.id);
}

export function runSupplierNormalizationSweep(query: SupplierQuery): SupplierNormalizationSweepResult {
  const safeQuery = supplierQuerySchema.parse(query);
  const db = getDatabase();

  const mergedCatalogSuppliers = deduplicateSuppliers(db, safeQuery.profileId);
  const linkedPurchases = reconcileSupplierReferences(db, safeQuery.profileId);
  const pendingEntries = listSupplierDirectory(safeQuery).filter((entry) => entry.status === "pending").length;
  const similarGroups = collectSupplierSimilarityGroups(db, safeQuery.profileId);

  return {
    linkedPurchases,
    mergedCatalogSuppliers,
    pendingEntries,
    similarGroups,
  };
}

export function getMonthlySale(query: MonthlySaleQuery): MonthlySale | null {
  const safeQuery = monthlySaleQuerySchema.parse(query);
  const row = getDatabase()
    .prepare<[number, number, number, number], MonthlySaleRow>(
       `SELECT id,
               profile_id,
               business_unit_id,
               period_month,
               period_year,
               total_amount,
               saldo_anterior,
               saldo_siguiente,
               renta,
               igv_pago,
               base_igv_manual,
               nota,
               created_at,
               updated_at
        FROM monthly_sales
       WHERE profile_id = ?
         AND business_unit_id = ?
         AND period_month = ?
         AND period_year = ?`,
    )
    .get(
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.month,
      safeQuery.year,
    );

  return row ? mapMonthlySale(row) : null;
}

export function saveMonthlySale(input: MonthlySaleInput): MonthlySale {
  const safeInput = monthlySaleInputSchema.parse(input);
  assertPeriodOpen(safeInput);

  getDatabase()
    .prepare(
      `INSERT INTO monthly_sales (
         profile_id,
         business_unit_id,
         period_month,
         period_year,
         total_amount,
         saldo_anterior,
         saldo_siguiente,
         renta,
         igv_pago,
         base_igv_manual,
         nota
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
       DO UPDATE SET
         total_amount = excluded.total_amount,
         saldo_anterior = excluded.saldo_anterior,
         saldo_siguiente = excluded.saldo_siguiente,
         renta = excluded.renta,
         igv_pago = excluded.igv_pago,
         base_igv_manual = excluded.base_igv_manual,
         nota = excluded.nota,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(
      safeInput.profileId,
      safeInput.businessUnitId,
      safeInput.month,
      safeInput.year,
      safeInput.totalAmount,
      safeInput.saldoAnterior ?? 0,
      safeInput.saldoSiguiente ?? 0,
      safeInput.renta ?? 0,
      safeInput.igvPago ?? 0,
      safeInput.baseIgvManual ?? null,
      safeInput.nota ?? null,
    );

  const saved = getMonthlySale(safeInput);

   if (!saved) {
    throw new Error("No se pudo guardar la venta.");
  }

  return saved;
}

export async function generateMonthlyXlsx(query: ExportMonthlyXlsxQuery): Promise<Buffer> {
  const safeQuery = purchaseQuerySchema.parse(query);
  const db = getDatabase();

  const unitRow = db
    .prepare<[number], { name: string }>(
      "SELECT name FROM business_units WHERE id = ?",
    )
    .get(safeQuery.businessUnitId);

  const unitName = unitRow?.name ?? "Unidad";

  const purchases = db
    .prepare<[number, number, number, number], PurchaseRow>(
      `SELECT id, profile_id, business_unit_id, supplier_id,
              period_month, period_year, purchase_date, ruc,
              supplier_name, invoice_number, amount, payment, note,
              created_at, updated_at
       FROM purchases
       WHERE profile_id = ? AND business_unit_id = ?
         AND period_month = ? AND period_year = ?
       ORDER BY purchase_date ASC, id ASC`,
    )
    .all(safeQuery.profileId, safeQuery.businessUnitId, safeQuery.month, safeQuery.year)
    .map(mapPurchase);

  const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);

  const sale = getMonthlySale(safeQuery);

  const MONTHS = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const monthName = MONTHS[safeQuery.month] ?? "";
  const year = safeQuery.year;
  const title = `${monthName} ${year} · ${unitName}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Metrion";

  // -- Sheet 1: Compras --
  const ws1 = wb.addWorksheet("Compras", {
    properties: { tabColor: { argb: "FF15803D" } },
  });

  ws1.mergeCells("A1:H1");
  const titleCell = ws1.getCell("A1");
  titleCell.value = `Compras - ${title}`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws1.getRow(1).height = 28;

  const purchaseHeaders = [
    "Fecha", "RUC", "Proveedor", "Factura", "Monto (PEN)", "Pago", "Nota",
  ];
  const headerRow = ws1.addRow(purchaseHeaders);
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF15803D" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD4D4D8" } },
      bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
      left: { style: "thin", color: { argb: "FFD4D4D8" } },
      right: { style: "thin", color: { argb: "FFD4D4D8" } },
    };
  });
  ws1.getRow(2).height = 24;

  for (const p of purchases) {
    const row = ws1.addRow([
      p.purchaseDate,
      p.ruc ?? "",
      p.supplierName,
      p.invoiceNumber ?? "",
      p.amount,
      p.payment ?? "",
      p.note ?? "",
    ]);
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E4E7" } },
        bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
        left: { style: "thin", color: { argb: "FFE4E4E7" } },
        right: { style: "thin", color: { argb: "FFE4E4E7" } },
      };
      if (colNumber === 5) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: "right" };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  // Total row
  const totalRow = ws1.addRow(["", "", "", "TOTAL COMPRAS", totalPurchases, "", ""]);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF15803D" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF15803D" } },
      bottom: { style: "medium", color: { argb: "FF15803D" } },
    };
    if (colNumber === 5) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: "right" };
    }
  });

  ws1.columns = [
    { key: "fecha", width: 14 },
    { key: "ruc", width: 14 },
    { key: "proveedor", width: 32 },
    { key: "factura", width: 16 },
    { key: "monto", width: 16 },
    { key: "pago", width: 20 },
    { key: "nota", width: 26 },
  ];

  ws1.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: purchases.length + 2, column: 7 },
  };
  ws1.views = [{ state: "frozen", ySplit: 2 }];

  // -- Sheet 2: Resumen Fiscal --
  const ws2 = wb.addWorksheet("Resumen Fiscal", {
    properties: { tabColor: { argb: "FF1D4ED8" } },
  });

  ws2.mergeCells("A1:C1");
  const titleCell2 = ws2.getCell("A1");
  titleCell2.value = `Resumen Fiscal - ${title}`;
  titleCell2.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E293B" } };
  titleCell2.alignment = { horizontal: "left", vertical: "middle" };
  ws2.getRow(1).height = 28;

  const summaryHeaders = ["Concepto", "Valor (PEN)", "Tipo"];
  const summaryHeaderRow = ws2.addRow(summaryHeaders);
  summaryHeaderRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD4D4D8" } },
      bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
      left: { style: "thin", color: { argb: "FFD4D4D8" } },
      right: { style: "thin", color: { argb: "FFD4D4D8" } },
    };
  });
  ws2.getRow(2).height = 24;

  const ventaMes = sale?.totalAmount ?? 0;
  const saldoAnterior = sale?.saldoAnterior ?? 0;
  const calc = calculateMonthlySummary({
    comprasMes: totalPurchases,
    saldoAnterior,
    ventaMes,
    rentaManual: sale?.renta && sale.renta !== 0 ? sale.renta : null,
    igvPagoManual: sale?.igvPago && sale.igvPago !== 0 ? sale.igvPago : null,
    saldoSiguienteManual: sale?.saldoSiguiente && sale.saldoSiguiente !== 0 ? sale.saldoSiguiente : null,
    baseIgvManual: sale?.baseIgvManual ?? null,
  });

  interface SummaryRow {
    concept: string;
    value: number;
    kind: string;
    bold?: boolean;
    accent?: boolean;
    separator?: boolean;
  }

  const summaryData: SummaryRow[] = [
    { concept: "Compras del mes", value: totalPurchases, kind: "Dato" },
    { concept: "Saldo anterior", value: saldoAnterior, kind: "Dato" },
    { concept: "Compra base", value: calc.compraBase, kind: "Calculado", bold: true },
    { concept: "", value: 0, kind: "", separator: true },
    { concept: "Venta del mes", value: ventaMes, kind: "Dato" },
    { concept: "", value: 0, kind: "", separator: true },
    { concept: "Diferencia", value: calc.diferencia, kind: "Calculado" },
    { concept: "Base IGV", value: calc.baseIgv, kind: "Calculado", accent: true },
    { concept: "Saldo siguiente", value: calc.saldoSiguiente, kind: "Calculado" },
    { concept: "", value: 0, kind: "", separator: true },
    { concept: "Renta", value: calc.renta, kind: "Calculado", accent: true },
    { concept: "IGV Pago", value: calc.igvPago, kind: "Calculado", accent: true },
    { concept: "", value: 0, kind: "", separator: true },
    { concept: "Total a pagar", value: calc.totalPagar, kind: "Resultado", bold: true, accent: true },
  ];

  let rowNum = 3;
  for (const item of summaryData) {
    if (item.separator) {
      rowNum++;
      continue;
    }
    const row = ws2.addRow([item.concept, item.value, item.kind]);
    const isBold = item.bold ?? false;
    const isAccent = item.accent ?? false;
    row.eachCell((cell, colNumber) => {
      const color = isAccent ? "FF1D4ED8" : "FF1E293B";
      cell.font = {
        name: "Arial",
        size: isBold ? 11 : 10,
        bold: isBold,
        color: { argb: color },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E4E7" } },
        bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
        left: { style: "thin", color: { argb: "FFE4E4E7" } },
        right: { style: "thin", color: { argb: "FFE4E4E7" } },
      };
      if (colNumber === 2) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: "right" };
      }
      if (colNumber === 3) {
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  ws2.columns = [
    { key: "concepto", width: 28 },
    { key: "valor", width: 20 },
    { key: "tipo", width: 16 },
  ];

  // -- Sheet 3: Información --
  const profileRow = db
    .prepare<[number], { name: string }>(
      "SELECT name FROM profiles WHERE id = ?",
    )
    .get(safeQuery.profileId);

  const profileName = profileRow?.name ?? "—";
  const closingStatus = getClosingStatus(safeQuery);

  const ws3 = wb.addWorksheet("Información", {
    properties: { tabColor: { argb: "FF71717A" } },
  });

  ws3.mergeCells("A1:B1");
  const titleCell3 = ws3.getCell("A1");
  titleCell3.value = `Metrion · Exportación`;
  titleCell3.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E293B" } };
  titleCell3.alignment = { horizontal: "left", vertical: "middle" };
  ws3.getRow(1).height = 28;

  const infoFields: { label: string; value: string }[] = [
    { label: "Perfil", value: profileName },
    { label: "Unidad", value: unitName },
    { label: "Periodo", value: title },
    { label: "Estado", value: closingStatus === "closed" ? "Cerrado" : "Abierto" },
    { label: "Exportado", value: new Date().toLocaleString("es-PE") },
    { label: "Compras registradas", value: `${purchases.length}` },
    { label: "Total compras", value: totalPurchases.toFixed(2) },
    { label: "Venta del mes", value: (sale?.totalAmount ?? 0).toFixed(2) },
    { label: "Total a pagar", value: calc.totalPagar.toFixed(2) },
  ];

  for (const [i, field] of infoFields.entries()) {
    const row = ws3.addRow([field.label, field.value]);
    const isAccent = field.label === "Total a pagar";
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: "Arial",
        size: 11,
        bold: colNumber === 1 || isAccent,
        color: { argb: isAccent && colNumber === 2 ? "FF1D4ED8" : "FF1E293B" },
      };
      cell.alignment = { vertical: "middle" };
      if (colNumber === 1) {
        cell.alignment = { ...cell.alignment, horizontal: "right" };
      }
    });
    row.height = 22;
  }

  ws3.columns = [
    { key: "label", width: 22 },
    { key: "value", width: 36 },
  ];

  ws3.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateYearlyXlsx(query: ExportYearlyXlsxQuery): Promise<Buffer> {
  const db = getDatabase();
  const MONTHS = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  // Find months that have data
  const monthsWithData: { month: number; total_purchases: number; purchase_count: number; total_sales: number; total_pagar: number; is_closed: number | null }[] = [];

  const allMonths = db
    .prepare<
      [number, number, number, number, number, number, number, number, number],
      { month: number; total_purchases: number; purchase_count: number; total_sales: number; total_pagar: number; is_closed: number | null }
    >(
      `SELECT
         m.month,
         COALESCE(p.total_purchases, 0) AS total_purchases,
         COALESCE(p.purchase_count, 0) AS purchase_count,
         COALESCE(s.total_sales, 0) AS total_sales,
         COALESCE(s.total_pagar, 0) AS total_pagar,
         c.is_closed
       FROM (
         SELECT 1 AS month UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
         UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
         UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
       ) m
       LEFT JOIN (
         SELECT period_month, SUM(amount) AS total_purchases, COUNT(*) AS purchase_count
         FROM purchases
         WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
         GROUP BY period_month
       ) p ON p.period_month = m.month
       LEFT JOIN (
         SELECT period_month,
                SUM(total_amount) AS total_sales,
                SUM(COALESCE(renta, 0)) + SUM(COALESCE(igv_pago, 0)) AS total_pagar
         FROM monthly_sales
         WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
         GROUP BY period_month
       ) s ON s.period_month = m.month
       LEFT JOIN (
         SELECT period_month, is_closed
         FROM monthly_closings
         WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
       ) c ON c.period_month = m.month
       ORDER BY m.month`,
    )
    .all(
      query.profileId, query.businessUnitId, query.year,
      query.profileId, query.businessUnitId, query.year,
      query.profileId, query.businessUnitId, query.year,
    );

  for (const row of allMonths) {
    if (row.purchase_count > 0 || row.total_sales > 0) {
      monthsWithData.push(row);
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Metrion";
  const year = query.year;
  const unitName = query.unitName;

  // Comparativa sheet first
  const wsComp = wb.addWorksheet("Comparativa Anual", {
    properties: { tabColor: { argb: "FF1D4ED8" } },
  });

  wsComp.mergeCells("A1:H1");
  const compTitle = wsComp.getCell("A1");
  compTitle.value = `Comparativa ${year} · ${unitName}`;
  compTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E293B" } };
  compTitle.alignment = { horizontal: "left", vertical: "middle" };
  wsComp.getRow(1).height = 28;

  const compHeaders = [
    "Mes", "Compras (PEN)", "Nº Compras", "Ventas (PEN)", "A pagar (PEN)", "Estado",
  ];
  const compHeaderRow = wsComp.addRow(compHeaders);
  compHeaderRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD4D4D8" } },
      bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
      left: { style: "thin", color: { argb: "FFD4D4D8" } },
      right: { style: "thin", color: { argb: "FFD4D4D8" } },
    };
  });
  wsComp.getRow(2).height = 24;

  let grandTotalPurchases = 0;
  let grandTotalSales = 0;
  let grandTotalPagar = 0;

  for (const md of monthsWithData) {
    grandTotalPurchases += md.total_purchases;
    grandTotalSales += md.total_sales;
    grandTotalPagar += md.total_pagar;
    const row = wsComp.addRow([
      MONTHS[md.month] ?? "",
      md.total_purchases,
      md.purchase_count,
      md.total_sales,
      md.total_pagar,
      md.is_closed === 1 ? "Cerrado" : "Abierto",
    ]);
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E4E7" } },
        bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
        left: { style: "thin", color: { argb: "FFE4E4E7" } },
        right: { style: "thin", color: { argb: "FFE4E4E7" } },
      };
      if ([2, 4, 5].includes(colNumber)) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: "right" };
      }
      if (colNumber === 3) cell.alignment = { horizontal: "center" };
    });
  }

  // Grand total row
  const grandRow = wsComp.addRow([
    "TOTAL", grandTotalPurchases, "", grandTotalSales, grandTotalPagar, "",
  ]);
  grandRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1D4ED8" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF1D4ED8" } },
      bottom: { style: "medium", color: { argb: "FF1D4ED8" } },
    };
    if ([2, 4, 5].includes(colNumber)) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: "right" };
    }
  });

  wsComp.columns = [
    { key: "mes", width: 16 },
    { key: "compras", width: 18 },
    { key: "ncompras", width: 12 },
    { key: "ventas", width: 18 },
    { key: "pagar", width: 18 },
    { key: "estado", width: 12 },
  ];
  wsComp.views = [{ state: "frozen", ySplit: 2 }];

  // Individual month sheets
  for (const md of monthsWithData) {
    const sheetName = MONTHS[md.month] ?? `Mes${md.month}`;
    const ws = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: "FF15803D" } },
    });

    const safeQuery = {
      profileId: query.profileId,
      businessUnitId: query.businessUnitId,
      month: md.month,
      year,
    };

    const purchases = db
      .prepare<[number, number, number, number], PurchaseRow>(
        `SELECT * FROM purchases
         WHERE profile_id = ? AND business_unit_id = ?
           AND period_month = ? AND period_year = ?
         ORDER BY purchase_date ASC, id ASC`,
      )
      .all(safeQuery.profileId, safeQuery.businessUnitId, safeQuery.month, safeQuery.year)
      .map(mapPurchase);

    const sale = getMonthlySale(safeQuery);

    const mt = `${sheetName} ${year}`;
    ws.mergeCells("A1:G1");
    const t = ws.getCell("A1");
    t.value = `Compras - ${mt}`;
    t.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF1E293B" } };
    t.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(1).height = 26;

    const hdrs = ["Fecha", "RUC", "Proveedor", "Factura", "Monto (PEN)", "Pago", "Nota"];
    const hr = ws.addRow(hdrs);
    hr.eachCell((c) => {
      c.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = {
        top: { style: "thin", color: { argb: "FFD4D4D8" } },
        bottom: { style: "thin", color: { argb: "FFD4D4D8" } },
        left: { style: "thin", color: { argb: "FFD4D4D8" } },
        right: { style: "thin", color: { argb: "FFD4D4D8" } },
      };
    });
    ws.getRow(2).height = 22;

    for (const p of purchases) {
      const r = ws.addRow([
        p.purchaseDate, p.ruc ?? "", p.supplierName, p.invoiceNumber ?? "",
        p.amount, p.payment ?? "", p.note ?? "",
      ]);
      r.eachCell((c, cn) => {
        c.font = { name: "Arial", size: 9, color: { argb: "FF1E293B" } };
        c.border = {
          top: { style: "thin", color: { argb: "FFE4E4E7" } },
          bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
          left: { style: "thin", color: { argb: "FFE4E4E7" } },
          right: { style: "thin", color: { argb: "FFE4E4E7" } },
        };
        if (cn === 5) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: "right" }; }
        if (cn === 1) c.alignment = { horizontal: "center" };
      });
    }

    const tr = ws.addRow(["", "", "", "TOTAL", md.total_purchases, "", ""]);
    tr.eachCell((c, cn) => {
      c.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF15803D" } };
      c.border = {
        top: { style: "medium", color: { argb: "FF15803D" } },
        bottom: { style: "medium", color: { argb: "FF15803D" } },
      };
      if (cn === 5) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: "right" }; }
    });

    // Sale info below purchases
    if (sale || md.total_sales > 0) {
      ws.addRow([]);
      const sRow = ws.addRow(["Venta del mes:", sale?.totalAmount ?? 0]);
      sRow.getCell(1).font = { name: "Arial", size: 10, bold: true };
      sRow.getCell(2).numFmt = '#,##0.00';
      if (sale?.nota) {
        const nRow = ws.addRow(["Nota:", sale.nota]);
        nRow.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF71717A" } };
      }
    }

    ws.columns = [
      { key: "fecha", width: 14 },
      { key: "ruc", width: 14 },
      { key: "proveedor", width: 30 },
      { key: "factura", width: 16 },
      { key: "monto", width: 16 },
      { key: "pago", width: 18 },
      { key: "nota", width: 24 },
    ];
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// --- Import session cache ---
const importSessions = new Map<string, {
  purchases: Array<{ purchase_date: string; ruc: string | null; supplier_name: string; invoice_number: string | null; amount: number; payment: string | null; period_month: number; period_year: number }>;
  sales: Array<{ total_amount: number; period_month: number; period_year: number }>;
  suppliers: Array<{ ruc: string | null; name: string }>;
}>();

type BackupFile = {
  kind: "metrion-backup";
  version: number;
  exportedAt: string;
  profiles: BackupFileProfile[];
};

type BackupFileProfile = {
  name: string;
  units: BackupFileUnit[];
};

type BackupFileUnit = {
  name: string;
  suppliers: Array<{ ruc: string | null; name: string; note: string | null }>;
  purchases: Array<{
    purchaseDate: string;
    periodMonth: number;
    periodYear: number;
    ruc: string | null;
    supplierName: string;
    invoiceNumber: string | null;
    amount: number;
    payment: string | null;
    note: string | null;
  }>;
  sales: Array<{
    periodMonth: number;
    periodYear: number;
    totalAmount: number;
    saldoAnterior: number;
    saldoSiguiente: number;
    renta: number;
    igvPago: number;
    baseIgvManual: number | null;
    nota: string | null;
  }>;
  closings: Array<{
    periodMonth: number;
    periodYear: number;
    isClosed: boolean;
    closedAt: string | null;
    reopenedAt: string | null;
  }>;
};

const backupImportSessions = new Map<string, BackupFile>();

function cleanImportText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("text" in v) return cleanImportText(v.text);
    if ("result" in v) return cleanImportText(v.result);
    if (Array.isArray((v as { richText?: unknown[] }).richText)) {
      return (v as { richText: Array<{ text?: string }> }).richText.map((p) => p.text ?? "").join("").trim();
    }
  }
  return String(value).trim();
}

function normImportText(value: unknown): string {
  return cleanImportText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function importAsNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cleanImportText(value).replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function importAsRuc(value: unknown): string | null {
  const text = cleanImportText(value).replace(/\D/g, "");
  return text.length >= 8 && text.length <= 11 ? text : null;
}

function importExcelSerialToDate(serial: number): string | null {
  if (serial < 30000 || serial > 60000) return null;
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000).toISOString().slice(0, 10);
}

function importAsDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const d = importExcelSerialToDate(importAsNumber(value) ?? 0);
  if (d) return d;
  const text = cleanImportText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const IMPORT_MONTHS = new Map([
  ["ENERO", 1], ["FEBRERO", 2], ["MARZO", 3], ["ABRIL", 4],
  ["MAYO", 5], ["JUNIO", 6], ["JULIO", 7], ["AGOSTO", 8],
  ["SETIEMBRE", 9], ["SEPTIEMBRE", 9], ["OCTUBRE", 10],
  ["NOVIEMBRE", 11], ["NOVIMBRE", 11], ["DICIEMBRE", 12], ["DICIEMBE", 12],
]);

function parseImportMonthYear(text: string): { month: number; year: number } | null {
  const n = normImportText(text);
  const month = [...IMPORT_MONTHS.entries()].find(([name]) => n.includes(name));
  const year = n.match(/\b(20\d{2})\b/)?.[1];
  return month && year ? { month: month[1], year: Number(year) } : null;
}

export async function parseImportPreview(query: ImportPreviewQuery & { filePath: string }): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(query.filePath);

  const purchases: Array<{ purchase_date: string; ruc: string | null; supplier_name: string; invoice_number: string | null; amount: number; payment: string | null; period_month: number; period_year: number }> = [];
  const sales: Array<{ total_amount: number; period_month: number; period_year: number }> = [];
  const supplierSet = new Map<string, { ruc: string; name: string }>();
  const warnings: string[] = [];
  let unitName = "";

  for (const sheet of wb.worksheets) {
    const sn = cleanImportText(sheet.name).toUpperCase();
    if (sn.includes("UNIT_A")) unitName = "UNIT_A";
    else if (sn.includes("UNIT_B")) unitName = "UNIT_B";
    else if (sn.includes("UNIT_C")) unitName = "UNIT_C";
    else unitName = cleanImportText(sheet.name);

    // Find month blocks (scan first 8 rows)
    interface Block { month: number; year: number; labelRow: number; startCol: number; endCol: number; }
    const blocks: Block[] = [];

    for (let row = 1; row <= Math.min(sheet.rowCount, 8); row++) {
      for (let col = 1; col <= sheet.columnCount; col++) {
        const text = cleanImportText(sheet.getRow(row).getCell(col).value);
        const period = parseImportMonthYear(text);
        if (period && normImportText(text).includes("COMPRA")) {
          blocks.push({ ...period, labelRow: row, startCol: col, endCol: 0 });
        }
      }
    }

    blocks.sort((a, b) => a.startCol - b.startCol || a.labelRow - b.labelRow);
    const unique: Block[] = [];
    for (const b of blocks) {
      const prev = unique[unique.length - 1];
      if (!prev || prev.startCol !== b.startCol) unique.push(b);
    }
    for (let i = 0; i < unique.length; i++) {
      unique[i].endCol = Math.min((unique[i + 1]?.startCol ?? sheet.columnCount + 1) - 1, unique[i].startCol + 6);
    }

    if (unique.length === 0) {
      warnings.push(`Hoja "${sheet.name}": sin bloques de meses detectados`);
      continue;
    }

    for (const block of unique) {
      const rows = [];
      for (let r = block.labelRow + 1; r <= sheet.rowCount; r++) {
        const cells: Array<{ col: number; value: unknown }> = [];
        for (let c = block.startCol; c <= block.endCol; c++) {
          cells.push({ col: c, value: sheet.getRow(r).getCell(c).value });
        }

        if (cells.every((c) => cleanImportText(c.value) === "")) continue;

        // Detect sale row
        for (let ci = 0; ci < cells.length; ci++) {
          if (normImportText(cells[ci].value) === "VENTA") {
            const amt = importAsNumber(cells[ci + 1]?.value);
            if (amt !== null) {
              rows.push({ type: "sale" as const, amount: amt, month: block.month, year: block.year });
            }
          }
        }

        // Parse purchase row
        const amountIndex = cells.findIndex((c) => {
          const n = importAsNumber(c.value);
          return n !== null && n >= 0 && n < 1_000_000;
        });
        if (amountIndex === -1) continue;

        const amount = importAsNumber(cells[amountIndex].value)!;
        const before = cells.slice(0, amountIndex);
        const after = cells.slice(amountIndex + 1);
        const supplierCell = before.slice().reverse().find((c) => cleanImportText(c.value) && !importAsRuc(c.value));
        const rucCell = before.find((c) => importAsRuc(c.value));
        if (!supplierCell) continue;

        const SUMMARY_WORDS = ["TOTAL", "COMPRA", "COMPRAS", "VENTA", "IGV", "RENTA", "SALDO", "PAGO", "PAGAR"];
        if (SUMMARY_WORDS.some((w) => normImportText(supplierCell.value) === w)) continue;

        const invoiceCell = after.find((c) => {
          const t = cleanImportText(c.value);
          return t && !importAsDate(c.value) && importAsNumber(c.value) === null;
        });
        const dateCell = after.find((c) => importAsDate(c.value));
        const purchaseDate = importAsDate(dateCell?.value);
        if (!purchaseDate) continue;

        const supplierName = cleanImportText(supplierCell.value);
        const ruc = importAsRuc(rucCell?.value);

        rows.push({
          type: "purchase" as const,
          purchase_date: purchaseDate,
          ruc,
          supplier_name: supplierName,
          invoice_number: cleanImportText(invoiceCell?.value) || null,
          amount,
          payment: null,
          month: block.month,
          year: block.year,
        });

        // Track supplier
        if (ruc) {
          supplierSet.set(`${ruc}`, { ruc, name: supplierName });
        }
      }

      for (const row of rows) {
        if (row.type === "purchase") {
          const { type, month, year, ...p } = row;
          purchases.push({ ...p, period_month: month, period_year: year });
        } else {
          sales.push({ total_amount: row.amount, period_month: row.month, period_year: row.year });
        }
      }
    }
  }

  // Deduplicate sales by month
  const saleByMonth = new Map<string, number>();
  for (const s of sales) {
    saleByMonth.set(`${s.period_year}-${s.period_month}`, s.total_amount);
  }

  // Build preview
  const monthMap = new Map<string, ImportMonthPreview>();
  for (const p of purchases) {
    const key = `${p.period_year}-${p.period_month}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month: p.period_month,
        year: p.period_year,
        monthName: (() => {
          const entry = [...IMPORT_MONTHS.entries()].find(([, v]) => v === p.period_month);
          if (!entry) return `Mes ${p.period_month}`;
          const name = entry[0];
          return name.charAt(0) + name.slice(1).toLowerCase();
        })(),
        purchaseCount: 0,
        totalPurchases: 0,
        totalSales: 0,
      });
    }
    const pm = monthMap.get(key)!;
    pm.purchaseCount++;
    pm.totalPurchases += p.amount;
  }
  for (const [key, totalAmount] of saleByMonth) {
    if (monthMap.has(key)) monthMap.get(key)!.totalSales = totalAmount;
  }

  const months = [...monthMap.values()].sort((a, b) => a.month - b.month);
  const sessionId = randomUUID();
  importSessions.set(sessionId, { purchases, sales: [...saleByMonth.entries()].map(([k, v]) => {
    const [y, m] = k.split("-").map(Number);
    return { total_amount: v, period_month: m, period_year: y };
  }), suppliers: [...supplierSet.values()] });

  return {
    sessionId,
    fileName: query.filePath.split(/[/\\]/).pop() ?? "archivo.xlsx",
    unitName,
    months,
    totalPurchases: purchases.length,
    totalMonths: months.length,
    warnings,
  };
}

export function applyImport(query: ImportApplyQuery): ImportApplyResult {
  const session = importSessions.get(query.sessionId);
  if (!session) return { success: false, inserted: { purchases: 0, sales: 0, suppliers: 0 }, errors: ["Sesión expirada."] };

  const selectedSet = new Set(query.selectedMonths.map((m) => `${m.year}-${m.month}`));
  const filteredPurchases = session.purchases.filter((p) => selectedSet.has(`${p.period_year}-${p.period_month}`));
  const filteredSales = session.sales.filter((s) => selectedSet.has(`${s.period_year}-${s.period_month}`));
  const errors: string[] = [];
  let insertedSuppliers = 0;
  let insertedPurchases = 0;
  let insertedSales = 0;

  const db = getDatabase();
  const insertSupplier = db.prepare("INSERT OR IGNORE INTO suppliers (profile_id, ruc, name) VALUES (?, ?, ?)");
  const insertPurchase = db.prepare(
    `INSERT OR IGNORE INTO purchases (profile_id, business_unit_id, period_month, period_year, purchase_date, ruc, supplier_name, invoice_number, amount, payment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upsertSale = db.prepare(
    `INSERT INTO monthly_sales (profile_id, business_unit_id, period_month, period_year, total_amount)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
     DO UPDATE SET total_amount = excluded.total_amount, updated_at = CURRENT_TIMESTAMP`,
  );

  const tx = db.transaction(() => {
    for (const s of session.suppliers) {
      const r = insertSupplier.run(query.profileId, s.ruc, s.name);
      if (r.changes > 0) insertedSuppliers++;
    }
    for (const p of filteredPurchases) {
      const r = insertPurchase.run(
        query.profileId, query.businessUnitId,
        p.period_month, p.period_year, p.purchase_date,
        p.ruc, p.supplier_name, p.invoice_number,
        p.amount, p.payment,
      );
      if (r.changes > 0) insertedPurchases++;
    }
    for (const s of filteredSales) {
      const r = upsertSale.run(
        query.profileId, query.businessUnitId,
        s.period_month, s.period_year, s.total_amount,
      );
      if (r.changes > 0) insertedSales++;
    }
  });

  try {
    tx();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error al aplicar importación.");
  }

  importSessions.delete(query.sessionId);

  return {
    success: errors.length === 0,
    inserted: { purchases: insertedPurchases, sales: insertedSales, suppliers: insertedSuppliers },
    errors,
  };
}

export function getBackupExportPreview(): ExportBackupPreview {
  const profiles = listProfiles().map<BackupSelectionProfile>((profile) => {
    const units = listBusinessUnits(profile.id).map((unit) => ({
      businessUnitId: unit.id,
      name: unit.name,
      selected: true,
    }));

    return {
      profileId: profile.id,
      name: profile.name,
      selected: true,
      units,
    };
  });

  return {
    profiles,
    totalProfiles: profiles.length,
    totalUnits: profiles.reduce((sum, profile) => sum + profile.units.length, 0),
  };
}

export function buildBackupFile(query: ExportBackupFileQuery): BackupFile {
  const db = getDatabase();
  const profiles: BackupFileProfile[] = [];

  for (const selection of query.profiles) {
    if (selection.businessUnitIds.length === 0) continue;

    const profile = db
      .prepare<[number], { id: number; name: string }>("SELECT id, name FROM profiles WHERE id = ?")
      .get(selection.profileId);
    if (!profile) continue;

    const units: BackupFileUnit[] = [];

    for (const businessUnitId of selection.businessUnitIds) {
      const unit = db
        .prepare<[number, number], { id: number; name: string }>(
          "SELECT id, name FROM business_units WHERE id = ? AND profile_id = ?",
        )
        .get(businessUnitId, selection.profileId);
      if (!unit) continue;

      const purchases = db
        .prepare<[number, number], PurchaseRow>(
          `SELECT id,
                  profile_id,
                  business_unit_id,
                  supplier_id,
                  period_month,
                  period_year,
                  purchase_date,
                  ruc,
                  supplier_name,
                  invoice_number,
                  amount,
                  payment,
                  note,
                  created_at,
                  updated_at
           FROM purchases
           WHERE profile_id = ? AND business_unit_id = ?
           ORDER BY period_year ASC, period_month ASC, purchase_date ASC, id ASC`,
        )
        .all(selection.profileId, businessUnitId);

      const sales = db
        .prepare<[number, number], MonthlySaleRow>(
          `SELECT id,
                  profile_id,
                  business_unit_id,
                  period_month,
                  period_year,
                  total_amount,
                  saldo_anterior,
                  saldo_siguiente,
                  renta,
                  igv_pago,
                  base_igv_manual,
                  nota,
                  created_at,
                  updated_at
           FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ?
           ORDER BY period_year ASC, period_month ASC`,
        )
        .all(selection.profileId, businessUnitId);

      const closings = db
        .prepare<[number, number], MonthlyClosingRow>(
          `SELECT id,
                  profile_id,
                  business_unit_id,
                  period_month,
                  period_year,
                  is_closed,
                  closed_at,
                  reopened_at,
                  created_at,
                  updated_at
           FROM monthly_closings
           WHERE profile_id = ? AND business_unit_id = ?
           ORDER BY period_year ASC, period_month ASC`,
        )
        .all(selection.profileId, businessUnitId);

      const rucs = new Set(
        purchases.map((purchase) => purchase.ruc).filter((value): value is string => Boolean(value)),
      );
      const supplierNames = new Set(
        purchases.map((purchase) => normalizeSupplierExactKey(purchase.supplier_name)).filter(Boolean),
      );

      const suppliers = db
        .prepare<[number], SupplierRow>(
          `SELECT id, profile_id, ruc, name, note, created_at, updated_at
           FROM suppliers
           WHERE profile_id = ?`,
        )
        .all(selection.profileId)
        .filter((supplier) =>
          Boolean(supplier.ruc && rucs.has(supplier.ruc)) || supplierNames.has(normalizeSupplierExactKey(supplier.name)),
        )
        .map((supplier) => ({
          ruc: supplier.ruc,
          name: supplier.name,
          note: supplier.note,
        }));

      units.push({
        name: unit.name,
        suppliers,
        purchases: purchases.map((purchase) => ({
          purchaseDate: purchase.purchase_date,
          periodMonth: purchase.period_month,
          periodYear: purchase.period_year,
          ruc: purchase.ruc,
          supplierName: purchase.supplier_name,
          invoiceNumber: purchase.invoice_number,
          amount: purchase.amount,
          payment: purchase.payment,
          note: purchase.note,
        })),
        sales: sales.map((sale) => ({
          periodMonth: sale.period_month,
          periodYear: sale.period_year,
          totalAmount: sale.total_amount,
          saldoAnterior: sale.saldo_anterior,
          saldoSiguiente: sale.saldo_siguiente,
          renta: sale.renta,
          igvPago: sale.igv_pago,
          baseIgvManual: sale.base_igv_manual,
          nota: sale.nota,
        })),
        closings: closings.map((closing) => ({
          periodMonth: closing.period_month,
          periodYear: closing.period_year,
          isClosed: Boolean(closing.is_closed),
          closedAt: closing.closed_at,
          reopenedAt: closing.reopened_at,
        })),
      });
    }

    if (units.length > 0) {
      profiles.push({
        name: profile.name,
        units,
      });
    }
  }

  return {
    kind: "metrion-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
  };
}

export function previewBackupImport(content: string, fileName: string): ImportBackupPreview {
  const backup = parseBackupFile(content);
  const db = getDatabase();
  const existingProfiles = db
    .prepare<[], { id: number; name: string }>("SELECT id, name FROM profiles")
    .all();

  const profiles: BackupImportProfileImpact[] = [];
  const totals = {
    profilesCreate: 0,
    unitsCreate: 0,
    suppliersDetected: 0,
    purchasesNew: 0,
    purchasesExisting: 0,
    salesNew: 0,
    salesUpdates: 0,
    closingsNew: 0,
    closingsUpdates: 0,
  };
  const warnings: string[] = [];

  for (const profile of backup.profiles) {
    const existingProfile = existingProfiles.find(
      (row) => normalizeEntityName(row.name) === normalizeEntityName(profile.name),
    );
    const willCreateProfile = !existingProfile;
    if (willCreateProfile) totals.profilesCreate += 1;

    const existingUnits = existingProfile
      ? db
          .prepare<[number], { id: number; name: string; is_active: number }>(
            "SELECT id, name, is_active FROM business_units WHERE profile_id = ?",
          )
          .all(existingProfile.id)
      : [];

    const unitImpacts: BackupImportUnitImpact[] = [];

    for (const unit of profile.units) {
      const existingUnit = existingUnits.find(
        (row) => normalizeEntityName(row.name) === normalizeEntityName(unit.name),
      );
      if (!existingUnit) totals.unitsCreate += 1;

      const existingPurchaseKeys = existingProfile && existingUnit
        ? new Set(
            db
              .prepare<[number, number], PurchaseRow>(
                `SELECT id,
                        profile_id,
                        business_unit_id,
                        supplier_id,
                        period_month,
                        period_year,
                        purchase_date,
                        ruc,
                        supplier_name,
                        invoice_number,
                        amount,
                        payment,
                        note,
                        created_at,
                        updated_at
                 FROM purchases
                 WHERE profile_id = ? AND business_unit_id = ?`,
              )
              .all(existingProfile.id, existingUnit.id)
              .map((purchase) => buildPurchaseFingerprint({
                periodMonth: purchase.period_month,
                periodYear: purchase.period_year,
                purchaseDate: purchase.purchase_date,
                ruc: purchase.ruc,
                supplierName: purchase.supplier_name,
                invoiceNumber: purchase.invoice_number,
                amount: purchase.amount,
              })),
          )
        : new Set<string>();

      const existingSales = existingProfile && existingUnit
        ? new Set(
            db
              .prepare<[number, number], { period_month: number; period_year: number }>(
                "SELECT period_month, period_year FROM monthly_sales WHERE profile_id = ? AND business_unit_id = ?",
              )
              .all(existingProfile.id, existingUnit.id)
              .map((sale) => `${sale.period_year}-${sale.period_month}`),
          )
        : new Set<string>();

      const existingClosings = existingProfile && existingUnit
        ? new Set(
            db
              .prepare<[number, number], { period_month: number; period_year: number }>(
                "SELECT period_month, period_year FROM monthly_closings WHERE profile_id = ? AND business_unit_id = ?",
              )
              .all(existingProfile.id, existingUnit.id)
              .map((closing) => `${closing.period_year}-${closing.period_month}`),
          )
        : new Set<string>();

      let purchasesNew = 0;
      let purchasesExisting = 0;
      for (const purchase of unit.purchases) {
        const key = buildPurchaseFingerprint(purchase);
        if (existingPurchaseKeys.has(key)) purchasesExisting += 1;
        else purchasesNew += 1;
      }

      let salesNew = 0;
      let salesUpdates = 0;
      for (const sale of unit.sales) {
        const key = `${sale.periodYear}-${sale.periodMonth}`;
        if (existingSales.has(key)) salesUpdates += 1;
        else salesNew += 1;
      }

      let closingsNew = 0;
      let closingsUpdates = 0;
      for (const closing of unit.closings) {
        const key = `${closing.periodYear}-${closing.periodMonth}`;
        if (existingClosings.has(key)) closingsUpdates += 1;
        else closingsNew += 1;
      }

      totals.suppliersDetected += unit.suppliers.length;
      totals.purchasesNew += purchasesNew;
      totals.purchasesExisting += purchasesExisting;
      totals.salesNew += salesNew;
      totals.salesUpdates += salesUpdates;
      totals.closingsNew += closingsNew;
      totals.closingsUpdates += closingsUpdates;

      unitImpacts.push({
        unitName: unit.name,
        suppliers: unit.suppliers.length,
        purchasesNew,
        purchasesExisting,
        salesNew,
        salesUpdates,
        closingsNew,
        closingsUpdates,
      });
    }

    profiles.push({
      profileName: profile.name,
      willCreateProfile,
      units: unitImpacts,
    });
  }

  if (backup.profiles.length === 0) {
    warnings.push("El archivo no contiene organizaciones seleccionadas.");
  }

  const sessionId = randomUUID();
  backupImportSessions.set(sessionId, backup);

  return {
    sessionId,
    fileName,
    version: backup.version,
    mode: "merge",
    profiles,
    totals,
    warnings,
  };
}

export function applyBackupImport(query: ImportBackupApplyQuery): ImportBackupApplyResult {
  const backup = backupImportSessions.get(query.sessionId);
  if (!backup) {
    return {
      success: false,
      created: { profiles: 0, units: 0, suppliers: 0, purchases: 0, sales: 0, closings: 0 },
      updated: { sales: 0, closings: 0 },
      errors: ["Sesión expirada."],
    };
  }

  const db = getDatabase();
  const created = { profiles: 0, units: 0, suppliers: 0, purchases: 0, sales: 0, closings: 0 };
  const updated = { sales: 0, closings: 0 };
  const errors: string[] = [];

  const tx = db.transaction(() => {
    for (const profile of backup.profiles) {
      const profileId = ensureBackupProfile(db, profile.name, created);

      for (const unit of profile.units) {
        const unitId = ensureBackupUnit(db, profileId, unit.name, created);
        const supplierMap = buildSupplierResolutionMap(db, profileId);
        const existingPurchaseKeys = loadExistingPurchaseKeys(db, profileId, unitId);
        const existingSales = loadExistingSalesMap(db, profileId, unitId);
        const existingClosings = loadExistingClosingsMap(db, profileId, unitId);

        for (const supplier of unit.suppliers) {
          const resolved = ensureBackupSupplier(db, profileId, supplier, created);
          supplierMap.byNormalizedName.set(normalizeEntityName(resolved.name), resolved.id);
          if (resolved.ruc) supplierMap.byRuc.set(resolved.ruc, resolved.id);
        }

        for (const purchase of unit.purchases) {
          const key = buildPurchaseFingerprint(purchase);
          if (existingPurchaseKeys.has(key)) continue;

          const supplierId = resolveSupplierIdForPurchase(supplierMap, purchase);
          db.prepare(
            `INSERT INTO purchases (
              profile_id, business_unit_id, supplier_id, period_month, period_year,
              purchase_date, ruc, supplier_name, invoice_number, amount, payment, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            profileId,
            unitId,
            supplierId,
            purchase.periodMonth,
            purchase.periodYear,
            purchase.purchaseDate,
            purchase.ruc,
            purchase.supplierName,
            purchase.invoiceNumber,
            purchase.amount,
            purchase.payment,
            purchase.note,
          );
          existingPurchaseKeys.add(key);
          created.purchases += 1;
        }

        for (const sale of unit.sales) {
          const key = `${sale.periodYear}-${sale.periodMonth}`;
          const existing = existingSales.get(key);
          if (existing) {
            db.prepare(
              `UPDATE monthly_sales
               SET total_amount = ?, saldo_anterior = ?, saldo_siguiente = ?, renta = ?,
                   igv_pago = ?, base_igv_manual = ?, nota = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
            ).run(
              sale.totalAmount,
              sale.saldoAnterior,
              sale.saldoSiguiente,
              sale.renta,
              sale.igvPago,
              sale.baseIgvManual,
              sale.nota,
              existing.id,
            );
            updated.sales += 1;
          } else {
            db.prepare(
              `INSERT INTO monthly_sales (
                profile_id, business_unit_id, period_month, period_year, total_amount,
                saldo_anterior, saldo_siguiente, renta, igv_pago, base_igv_manual, nota
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              profileId,
              unitId,
              sale.periodMonth,
              sale.periodYear,
              sale.totalAmount,
              sale.saldoAnterior,
              sale.saldoSiguiente,
              sale.renta,
              sale.igvPago,
              sale.baseIgvManual,
              sale.nota,
            );
            created.sales += 1;
          }
        }

        for (const closing of unit.closings) {
          const key = `${closing.periodYear}-${closing.periodMonth}`;
          const existing = existingClosings.get(key);
          if (existing) {
            db.prepare(
              `UPDATE monthly_closings
               SET is_closed = ?, closed_at = ?, reopened_at = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
            ).run(
              closing.isClosed ? 1 : 0,
              closing.closedAt,
              closing.reopenedAt,
              existing.id,
            );
            updated.closings += 1;
          } else {
            db.prepare(
              `INSERT INTO monthly_closings (
                profile_id, business_unit_id, period_month, period_year, is_closed, closed_at, reopened_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              profileId,
              unitId,
              closing.periodMonth,
              closing.periodYear,
              closing.isClosed ? 1 : 0,
              closing.closedAt,
              closing.reopenedAt,
            );
            created.closings += 1;
          }
        }
      }
    }
  });

  try {
    tx();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "No se pudo restaurar el backup.");
  }

  backupImportSessions.delete(query.sessionId);

  return {
    success: errors.length === 0,
    created,
    updated,
    errors,
  };
}

export function getAppContext(preferredProfileId?: number | null): AppContext {
  const profiles = listProfiles();
  const globalPreferred = (globalThis as Record<string, unknown>).__selectedProfileId as number | undefined;
  const selectedProfileId = preferredProfileId ?? globalPreferred ?? profiles[0]?.id ?? null;
  const businessUnits = selectedProfileId
    ? listBusinessUnits(selectedProfileId)
    : [];
  const selectedBusinessUnitId = businessUnits[0]?.id ?? null;
  const now = new Date();
  const period = {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
  const closingStatus =
    selectedProfileId && selectedBusinessUnitId
      ? getClosingStatus({
          profileId: selectedProfileId,
          businessUnitId: selectedBusinessUnitId,
          month: period.month,
          year: period.year,
        })
      : "open";

  return {
    profiles,
    businessUnits,
    selectedProfileId,
    selectedBusinessUnitId,
    period,
    closingStatus,
  };
}

export function createProfile(input: { name: string }): Profile {
  try {
    const result = getDatabase()
      .prepare("INSERT INTO profiles (name) VALUES (?)")
      .run(input.name.trim());
    return { id: Number(result.lastInsertRowid), name: input.name.trim() };
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function updateProfile(input: { id: number; name: string }): Profile {
  if (!Number.isInteger(input.id) || input.id <= 0) throw new Error("Perfil inválido.");
  try {
    const r = getDatabase()
      .prepare("UPDATE profiles SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(input.name.trim(), input.id);
    if (r.changes === 0) throw new Error("Perfil no encontrado.");
    return { id: input.id, name: input.name.trim() };
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function deleteProfile(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Perfil inválido.");
  const count = (getDatabase()
    .prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM profiles")
    .get()?.count ?? 0);
  if (count <= 1) throw new Error("No se puede eliminar el último perfil.");
  getDatabase().prepare("DELETE FROM profiles WHERE id = ?").run(id);
}

export function createBusinessUnit(input: { profileId: number; name: string }): BusinessUnit {
  try {
    const result = getDatabase()
      .prepare("INSERT INTO business_units (profile_id, name) VALUES (?, ?)")
      .run(input.profileId, input.name.trim());
    return {
      id: Number(result.lastInsertRowid),
      profileId: input.profileId,
      name: input.name.trim(),
      isActive: true,
    };
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function updateBusinessUnit(input: { id: number; name: string }): BusinessUnit {
  if (!Number.isInteger(input.id) || input.id <= 0) throw new Error("Unidad inválida.");
  try {
    const r = getDatabase()
      .prepare("UPDATE business_units SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(input.name.trim(), input.id);
    if (r.changes === 0) throw new Error("Unidad no encontrada.");
    return {
      id: input.id,
      profileId: (getDatabase()
        .prepare<[number], { profile_id: number }>("SELECT profile_id FROM business_units WHERE id = ?")
        .get(input.id))!.profile_id,
      name: input.name.trim(),
      isActive: true,
    };
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function deleteBusinessUnit(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Unidad inválida.");
  getDatabase().prepare("DELETE FROM business_units WHERE id = ?").run(id);
}

export function deactivateBusinessUnit(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Unidad inválida.");
  getDatabase().prepare("UPDATE business_units SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

export function listMonthlyPeriods(query: MonthlyPeriodsQuery): MonthlyPeriodSummary[] {
  const periodRows = getDatabase()
    .prepare<
      [number, number, number, number, number, number, number, number, number, number],
      { month: number; year: number; total_purchases: number; purchase_count: number; total_sales: number; total_pagar: number; is_closed: number | null }
    >(
      `SELECT
         periods.month,
         periods.year,
         COALESCE(p.total_purchases, 0) AS total_purchases,
         COALESCE(p.purchase_count, 0) AS purchase_count,
         COALESCE(s.total_sales, 0) AS total_sales,
         COALESCE(s.total_pagar, 0) AS total_pagar,
         c.is_closed
       FROM (
         SELECT period_month AS month, period_year AS year FROM purchases
         WHERE profile_id = ? AND business_unit_id = ?
         UNION
         SELECT period_month, period_year FROM monthly_sales
         WHERE profile_id = ? AND business_unit_id = ?
       ) periods
       LEFT JOIN (
         SELECT period_month, period_year,
                SUM(amount) AS total_purchases,
                COUNT(*) AS purchase_count
         FROM purchases WHERE profile_id = ? AND business_unit_id = ?
         GROUP BY period_month, period_year
       ) p ON p.period_month = periods.month AND p.period_year = periods.year
       LEFT JOIN (
         SELECT period_month, period_year,
                SUM(total_amount) AS total_sales,
                SUM(COALESCE(renta, 0)) + SUM(COALESCE(igv_pago, 0)) AS total_pagar
         FROM monthly_sales WHERE profile_id = ? AND business_unit_id = ?
         GROUP BY period_month, period_year
       ) s ON s.period_month = periods.month AND s.period_year = periods.year
       LEFT JOIN (
         SELECT period_month, period_year, is_closed
         FROM monthly_closings WHERE profile_id = ? AND business_unit_id = ?
       ) c ON c.period_month = periods.month AND c.period_year = periods.year
       ORDER BY periods.year DESC, periods.month DESC`,
    )
    .all(
      query.profileId, query.businessUnitId,
      query.profileId, query.businessUnitId,
      query.profileId, query.businessUnitId,
      query.profileId, query.businessUnitId,
      query.profileId, query.businessUnitId,
    );

  return periodRows.map((row) => ({
    month: row.month,
    year: row.year,
    totalPurchases: row.total_purchases,
    purchaseCount: row.purchase_count,
    totalSales: row.total_sales,
    totalPagar: row.total_pagar,
    isClosed: row.is_closed === 1,
  }));
}

export function getDashboardData(query: DashboardQuery): DashboardData {
  const safeQuery = monthlySaleQuerySchema.parse(query);
  const db = getDatabase();
  const previousPeriod =
    safeQuery.month === 1
      ? { month: 12, year: safeQuery.year - 1 }
      : { month: safeQuery.month - 1, year: safeQuery.year };

  const seriesRows = db
    .prepare<
      [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number],
      {
        month: number;
        year: number;
        total_purchases: number;
        purchase_count: number;
        total_sales: number;
        total_pagar: number;
        is_closed: number | null;
      }
    >(
      `SELECT *
       FROM (
         SELECT
           periods.month,
           periods.year,
           COALESCE(p.total_purchases, 0) AS total_purchases,
           COALESCE(p.purchase_count, 0) AS purchase_count,
           COALESCE(s.total_sales, 0) AS total_sales,
           COALESCE(s.total_pagar, 0) AS total_pagar,
           c.is_closed
         FROM (
           SELECT period_month AS month, period_year AS year FROM purchases
           WHERE profile_id = ? AND business_unit_id = ?
             AND (period_year < ? OR (period_year = ? AND period_month <= ?))
           UNION
           SELECT period_month, period_year FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ?
             AND (period_year < ? OR (period_year = ? AND period_month <= ?))
         ) periods
         LEFT JOIN (
           SELECT period_month, period_year,
                  SUM(amount) AS total_purchases,
                  COUNT(*) AS purchase_count
           FROM purchases
           WHERE profile_id = ? AND business_unit_id = ?
           GROUP BY period_month, period_year
         ) p ON p.period_month = periods.month AND p.period_year = periods.year
         LEFT JOIN (
           SELECT period_month, period_year,
                  SUM(total_amount) AS total_sales,
                  SUM(COALESCE(renta, 0)) + SUM(COALESCE(igv_pago, 0)) AS total_pagar
           FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ?
           GROUP BY period_month, period_year
         ) s ON s.period_month = periods.month AND s.period_year = periods.year
         LEFT JOIN (
           SELECT period_month, period_year, is_closed
           FROM monthly_closings
           WHERE profile_id = ? AND business_unit_id = ?
         ) c ON c.period_month = periods.month AND c.period_year = periods.year
         ORDER BY periods.year DESC, periods.month DESC
         LIMIT 12
       ) recent
       ORDER BY recent.year ASC, recent.month ASC`,
    )
    .all(
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.year,
      safeQuery.year,
      safeQuery.month,
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.year,
      safeQuery.year,
      safeQuery.month,
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.profileId,
      safeQuery.businessUnitId,
      safeQuery.profileId,
      safeQuery.businessUnitId,
    );

  const series: DashboardSeriesPoint[] = seriesRows.map((row) => ({
    month: row.month,
    year: row.year,
    label: `${MONTH_LABELS_SHORT[row.month] ?? row.month}/${String(row.year).slice(-2)}`,
    totalPurchases: row.total_purchases,
    totalSales: row.total_sales,
    totalPagar: row.total_pagar,
    purchaseCount: row.purchase_count,
    isClosed: row.is_closed === 1,
  }));

  const currentRow =
    db
      .prepare<
        [number, number, number, number, number, number, number, number],
        {
          total_purchases: number;
          purchase_count: number;
          total_sales: number;
          total_pagar: number;
          is_closed: number | null;
        }
      >(
        `SELECT
           COALESCE(p.total_purchases, 0) AS total_purchases,
           COALESCE(p.purchase_count, 0) AS purchase_count,
           COALESCE(s.total_sales, 0) AS total_sales,
           COALESCE(s.total_pagar, 0) AS total_pagar,
           c.is_closed
         FROM (SELECT ? AS period_month, ? AS period_year) target
         LEFT JOIN (
           SELECT period_month, period_year,
                  SUM(amount) AS total_purchases,
                  COUNT(*) AS purchase_count
           FROM purchases
           WHERE profile_id = ? AND business_unit_id = ?
           GROUP BY period_month, period_year
         ) p ON p.period_month = target.period_month AND p.period_year = target.period_year
         LEFT JOIN (
           SELECT period_month, period_year,
                  SUM(total_amount) AS total_sales,
                  SUM(COALESCE(renta, 0)) + SUM(COALESCE(igv_pago, 0)) AS total_pagar
           FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ?
           GROUP BY period_month, period_year
         ) s ON s.period_month = target.period_month AND s.period_year = target.period_year
         LEFT JOIN (
           SELECT period_month, period_year, is_closed
           FROM monthly_closings
           WHERE profile_id = ? AND business_unit_id = ?
         ) c ON c.period_month = target.period_month AND c.period_year = target.period_year`,
      )
      .get(
        safeQuery.month,
        safeQuery.year,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.profileId,
        safeQuery.businessUnitId,
      ) ?? {
      total_purchases: 0,
      purchase_count: 0,
      total_sales: 0,
      total_pagar: 0,
      is_closed: 0,
    };

  const yearOverview =
    db
      .prepare<
        [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number],
        {
          tracked_months: number;
          closed_months: number;
          open_months: number;
          months_with_purchases_no_sales: number;
          months_with_sales_pending_close: number;
        }
      >(
        `SELECT
           COUNT(*) AS tracked_months,
           SUM(CASE WHEN COALESCE(c.is_closed, 0) = 1 THEN 1 ELSE 0 END) AS closed_months,
           SUM(CASE WHEN COALESCE(c.is_closed, 0) = 1 THEN 0 ELSE 1 END) AS open_months,
           SUM(CASE WHEN COALESCE(p.total_purchases, 0) > 0 AND COALESCE(s.total_sales, 0) = 0 THEN 1 ELSE 0 END) AS months_with_purchases_no_sales,
           SUM(CASE WHEN COALESCE(s.total_sales, 0) > 0 AND COALESCE(c.is_closed, 0) <> 1 THEN 1 ELSE 0 END) AS months_with_sales_pending_close
         FROM (
           SELECT period_month AS month, period_year AS year FROM purchases
           WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
           UNION
           SELECT period_month, period_year FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
         ) periods
         LEFT JOIN (
           SELECT period_month, period_year, SUM(amount) AS total_purchases
           FROM purchases
           WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
           GROUP BY period_month, period_year
         ) p ON p.period_month = periods.month AND p.period_year = periods.year
         LEFT JOIN (
           SELECT period_month, period_year, SUM(total_amount) AS total_sales
           FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
           GROUP BY period_month, period_year
         ) s ON s.period_month = periods.month AND s.period_year = periods.year
         LEFT JOIN (
           SELECT period_month, period_year, is_closed
           FROM monthly_closings
           WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?
         ) c ON c.period_month = periods.month AND c.period_year = periods.year`,
      )
      .get(
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.year,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.year,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.year,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.year,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.year,
      ) ?? {
      tracked_months: 0,
      closed_months: 0,
      open_months: 0,
      months_with_purchases_no_sales: 0,
      months_with_sales_pending_close: 0,
    };

  const previousRow =
    db
      .prepare<
        [number, number, number, number, number, number, number, number, number, number],
        {
          total_purchases: number;
          purchase_count: number;
          total_sales: number;
          total_pagar: number;
          has_data: number;
        }
      >(
        `SELECT
           COALESCE(p.total_purchases, 0) AS total_purchases,
           COALESCE(p.purchase_count, 0) AS purchase_count,
           COALESCE(s.total_sales, 0) AS total_sales,
           COALESCE(s.total_pagar, 0) AS total_pagar,
           CASE
             WHEN periods.month IS NULL THEN 0
             ELSE 1
           END AS has_data
         FROM (SELECT ? AS month, ? AS year) target
         LEFT JOIN (
           SELECT period_month AS month, period_year AS year FROM purchases
           WHERE profile_id = ? AND business_unit_id = ?
           UNION
           SELECT period_month, period_year FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ?
         ) periods ON periods.month = target.month AND periods.year = target.year
         LEFT JOIN (
           SELECT period_month, period_year,
                  SUM(amount) AS total_purchases,
                  COUNT(*) AS purchase_count
           FROM purchases
           WHERE profile_id = ? AND business_unit_id = ?
           GROUP BY period_month, period_year
         ) p ON p.period_month = target.month AND p.period_year = target.year
         LEFT JOIN (
           SELECT period_month, period_year,
                  SUM(total_amount) AS total_sales,
                  SUM(COALESCE(renta, 0)) + SUM(COALESCE(igv_pago, 0)) AS total_pagar
           FROM monthly_sales
           WHERE profile_id = ? AND business_unit_id = ?
           GROUP BY period_month, period_year
         ) s ON s.period_month = target.month AND s.period_year = target.year`,
      )
      .get(
        previousPeriod.month,
        previousPeriod.year,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.profileId,
        safeQuery.businessUnitId,
        safeQuery.profileId,
        safeQuery.businessUnitId,
      ) ?? {
      total_purchases: 0,
      purchase_count: 0,
      total_sales: 0,
      total_pagar: 0,
      has_data: 0,
    };

  const previousDifference = previousRow.total_sales - previousRow.total_purchases;
  const previousLabel = `${MONTH_LABELS_SHORT[previousPeriod.month] ?? previousPeriod.month}/${String(previousPeriod.year).slice(-2)}`;
  const hasComparison = previousRow.has_data === 1;

  function buildMetricComparison(currentValue: number, previousValue: number) {
    if (!hasComparison) {
      return {
        hasComparison: false,
        previousValue: null,
        delta: null,
        deltaPercent: null,
        previousLabel: null,
      };
    }

    const delta = currentValue - previousValue;
    const deltaPercent = previousValue === 0 ? null : delta / previousValue;

    return {
      hasComparison: true,
      previousValue,
      delta,
      deltaPercent,
      previousLabel,
    };
  }

  const yearlyTotalPurchases =
    db
      .prepare<[number, number, number], { total: number | null }>(
        `SELECT SUM(amount) AS total
         FROM purchases
         WHERE profile_id = ? AND business_unit_id = ? AND period_year = ?`,
      )
      .get(safeQuery.profileId, safeQuery.businessUnitId, safeQuery.year)?.total ?? 0;

  const topSuppliersRows = db
    .prepare<
      [number, number, number],
      {
        supplier_key: string;
        supplier_name: string;
        ruc: string | null;
        total_amount: number;
        purchase_count: number;
      }
    >(
      `SELECT
         CASE
           WHEN p.supplier_id IS NOT NULL THEN 'id:' || p.supplier_id
           WHEN NULLIF(TRIM(COALESCE(p.ruc, '')), '') IS NOT NULL THEN 'r:' || TRIM(p.ruc)
           ELSE 'n:' || LOWER(TRIM(p.supplier_name))
         END AS supplier_key,
         COALESCE(
           MAX(NULLIF(TRIM(s.name), '')),
           MAX(NULLIF(TRIM(p.supplier_name), '')),
           'Sin nombre'
         ) AS supplier_name,
         COALESCE(
           MAX(NULLIF(TRIM(s.ruc), '')),
           MAX(NULLIF(TRIM(p.ruc), ''))
         ) AS ruc,
         SUM(p.amount) AS total_amount,
         COUNT(*) AS purchase_count
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.profile_id = ? AND p.business_unit_id = ? AND p.period_year = ?
       GROUP BY supplier_key
       ORDER BY total_amount DESC, supplier_name ASC
       LIMIT 6`,
    )
    .all(safeQuery.profileId, safeQuery.businessUnitId, safeQuery.year);

  const topSuppliers: DashboardSupplierRankingItem[] = topSuppliersRows.map((row) => ({
    supplierKey: row.supplier_key,
    supplierName: row.supplier_name,
    ruc: row.ruc,
    totalAmount: row.total_amount,
    purchaseCount: row.purchase_count,
    share: yearlyTotalPurchases > 0 ? row.total_amount / yearlyTotalPurchases : 0,
  }));

  return {
    current: {
      month: safeQuery.month,
      year: safeQuery.year,
      totalPurchases: currentRow.total_purchases,
      totalSales: currentRow.total_sales,
      totalPagar: currentRow.total_pagar,
      purchaseCount: currentRow.purchase_count,
      difference: currentRow.total_sales - currentRow.total_purchases,
      isClosed: currentRow.is_closed === 1,
    },
    comparisons: {
      totalPurchases: buildMetricComparison(currentRow.total_purchases, previousRow.total_purchases),
      totalSales: buildMetricComparison(currentRow.total_sales, previousRow.total_sales),
      totalPagar: buildMetricComparison(currentRow.total_pagar, previousRow.total_pagar),
      difference: buildMetricComparison(
        currentRow.total_sales - currentRow.total_purchases,
        previousDifference,
      ),
    },
    series,
    yearOverview: {
      trackedMonths: yearOverview.tracked_months,
      closedMonths: yearOverview.closed_months,
      openMonths: yearOverview.open_months,
      monthsWithPurchasesNoSales: yearOverview.months_with_purchases_no_sales,
      monthsWithSalesPendingClose: yearOverview.months_with_sales_pending_close,
    },
    topSuppliers,
  };
}

function assertPeriodOpen(query: PurchaseQuery): void {
  if (getClosingStatus(query) === "closed") {
    throw new Error("El mes esta cerrado.");
  }
}

function getMonthlyClosing(query: MonthlyClosingQuery): MonthlyClosing {
  const row = getDatabase()
    .prepare<[number, number, number, number], MonthlyClosingRow>(
      `SELECT id,
              profile_id,
              business_unit_id,
              period_month,
              period_year,
              is_closed,
              closed_at,
              reopened_at,
              created_at,
              updated_at
       FROM monthly_closings
       WHERE profile_id = ?
         AND business_unit_id = ?
         AND period_month = ?
         AND period_year = ?`,
    )
    .get(query.profileId, query.businessUnitId, query.month, query.year);

  if (!row) {
    throw new Error("Cierre no encontrado.");
  }

  return mapMonthlyClosing(row);
}

function getPurchaseById(id: number): Purchase {
  const row = getDatabase()
    .prepare<[number], PurchaseRow>(
      `SELECT id,
              profile_id,
              business_unit_id,
              supplier_id,
              period_month,
              period_year,
              purchase_date,
              ruc,
              supplier_name,
              invoice_number,
              amount,
              payment,
              note,
              created_at,
              updated_at
       FROM purchases
       WHERE id = ?`,
    )
    .get(id);

  if (!row) {
    throw new Error("Compra no encontrada.");
  }

  return mapPurchase(row);
}

function getSupplierById(id: number): Supplier {
  const row = getDatabase()
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE id = ?`,
    )
    .get(id);

  if (!row) {
    throw new Error("Proveedor no encontrado.");
  }

  return mapSupplier(row);
}

function normalizeSqliteError(error: unknown): Error {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE"
  ) {
    return new Error("Ya existe un proveedor con ese nombre o RUC.");
  }

  return error instanceof Error ? error : new Error("Operacion invalida.");
}

function assertSupplierCatalogUniqueness(
  db: Database.Database,
  profileId: number,
  name: string,
  ruc: string | null,
  ignoreId?: number,
): void {
  const normalizedName = normalizeSupplierExactKey(name);
  const suppliers = db
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE profile_id = ?`,
    )
    .all(profileId);

  for (const supplier of suppliers) {
    if (ignoreId && supplier.id === ignoreId) continue;

    if (ruc && supplier.ruc && supplier.ruc === ruc) {
      throw new Error("Ya existe un proveedor con ese RUC.");
    }

    if (normalizeSupplierExactKey(supplier.name) === normalizedName) {
      throw new Error("Ya existe un proveedor con un nombre equivalente.");
    }
  }
}

function reconcileSupplierReferences(db: Database.Database, profileId: number): number {
  const suppliers = db
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE profile_id = ?`,
    )
    .all(profileId)
    .map(mapSupplier);

  const byId = new Map<number, Supplier>();
  const byRuc = new Map<string, Supplier>();
  const byNormalizedName = new Map<string, Supplier>();

  for (const supplier of suppliers) {
    byId.set(supplier.id, supplier);
    if (supplier.ruc) {
      byRuc.set(supplier.ruc, supplier);
    }
    byNormalizedName.set(normalizeSupplierExactKey(supplier.name), supplier);
  }

  const purchases = db
    .prepare<[number], Pick<PurchaseRow, "id" | "supplier_id" | "ruc" | "supplier_name">>(
      `SELECT id, supplier_id, ruc, supplier_name
       FROM purchases
       WHERE profile_id = ?`,
    )
    .all(profileId);

  const updatePurchase = db.prepare(
    `UPDATE purchases
     SET supplier_id = ?,
         supplier_name = ?,
         ruc = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  );
  let linkedCount = 0;

  db.transaction(() => {
    for (const purchase of purchases) {
      const currentSupplier = purchase.supplier_id ? byId.get(purchase.supplier_id) ?? null : null;
      const matchedByRuc = purchase.ruc ? byRuc.get(purchase.ruc) ?? null : null;
      const matchedByName = byNormalizedName.get(normalizeSupplierExactKey(purchase.supplier_name)) ?? null;
      const targetSupplier = currentSupplier ?? matchedByRuc ?? matchedByName;

      if (!targetSupplier) continue;

      const nextRuc = targetSupplier.ruc ?? normalizeNullableText(purchase.ruc);
      if (
        purchase.supplier_id !== targetSupplier.id ||
        purchase.supplier_name !== targetSupplier.name ||
        normalizeNullableText(purchase.ruc) !== nextRuc
      ) {
        updatePurchase.run(targetSupplier.id, targetSupplier.name, nextRuc, purchase.id);
        linkedCount += 1;
      }
    }
  })();

  return linkedCount;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS business_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, name),
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      ruc TEXT,
      name TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, ruc),
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      business_unit_id INTEGER NOT NULL,
      supplier_id INTEGER,
      period_month INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
      period_year INTEGER NOT NULL,
      purchase_date TEXT NOT NULL,
      ruc TEXT,
      supplier_name TEXT NOT NULL,
      invoice_number TEXT,
      amount REAL NOT NULL CHECK(amount >= 0),
      payment TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY(business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_period
      ON purchases(profile_id, business_unit_id, period_year, period_month);

    CREATE TABLE IF NOT EXISTS monthly_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      business_unit_id INTEGER NOT NULL,
      period_month INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
      period_year INTEGER NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
      saldo_anterior REAL NOT NULL DEFAULT 0,
      saldo_siguiente REAL NOT NULL DEFAULT 0,
      renta REAL NOT NULL DEFAULT 0,
      igv_pago REAL NOT NULL DEFAULT 0,
      base_igv_manual REAL NULL,
      nota TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, business_unit_id, period_month, period_year),
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY(business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monthly_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      business_unit_id INTEGER NOT NULL,
      period_month INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
      period_year INTEGER NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      closed_at TEXT,
      reopened_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, business_unit_id, period_month, period_year),
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY(business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
    );
  `);

  db.pragma("foreign_keys = OFF");

    const columns = [
      { name: "saldo_anterior", sql: "ALTER TABLE monthly_sales ADD COLUMN saldo_anterior REAL NOT NULL DEFAULT 0" },
      { name: "saldo_siguiente", sql: "ALTER TABLE monthly_sales ADD COLUMN saldo_siguiente REAL NOT NULL DEFAULT 0" },
      { name: "renta", sql: "ALTER TABLE monthly_sales ADD COLUMN renta REAL NOT NULL DEFAULT 0" },
      { name: "igv_pago", sql: "ALTER TABLE monthly_sales ADD COLUMN igv_pago REAL NOT NULL DEFAULT 0" },
      { name: "nota", sql: "ALTER TABLE monthly_sales ADD COLUMN nota TEXT" },
      { name: "base_igv_manual", sql: "ALTER TABLE monthly_sales ADD COLUMN base_igv_manual REAL NULL" },
    ];

  const existingCols = db
    .prepare<[], { name: string }>("PRAGMA table_info(monthly_sales)")
    .all()
    .map((row) => row.name);

  for (const col of columns) {
    if (!existingCols.includes(col.name)) {
      db.exec(col.sql);
    }
  }

  const purchaseColumns = db
    .prepare<[], { name: string }>("PRAGMA table_info(purchases)")
    .all()
    .map((row) => row.name);

  if (!purchaseColumns.includes("supplier_id")) {
    db.exec("ALTER TABLE purchases ADD COLUMN supplier_id INTEGER");
  }

  const supplierRucColumn = db
    .prepare<[], { name: string; notnull: number }>("PRAGMA table_info(suppliers)")
    .all()
    .find((column) => column.name === "ruc");

  if (supplierRucColumn?.notnull) {
    db.exec(`
      ALTER TABLE suppliers RENAME TO suppliers_legacy;

      CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        ruc TEXT,
        name TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(profile_id, ruc),
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );

      INSERT INTO suppliers (id, profile_id, ruc, name, note, created_at, updated_at)
      SELECT id, profile_id, NULLIF(TRIM(ruc), ''), name, note, created_at, updated_at
      FROM suppliers_legacy;

      DROP TABLE suppliers_legacy;
    `);
  }

  const purchaseSupplierForeignKey = db
    .prepare<[], { table: string; from: string }>("PRAGMA foreign_key_list(purchases)")
    .all()
    .find((foreignKey) => foreignKey.from === "supplier_id");

  if (purchaseSupplierForeignKey && purchaseSupplierForeignKey.table !== "suppliers") {
    db.exec(`
      ALTER TABLE purchases RENAME TO purchases_legacy;

      CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        business_unit_id INTEGER NOT NULL,
        supplier_id INTEGER,
        period_month INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
        period_year INTEGER NOT NULL,
        purchase_date TEXT NOT NULL,
        ruc TEXT,
        supplier_name TEXT NOT NULL,
        invoice_number TEXT,
        amount REAL NOT NULL CHECK(amount >= 0),
        payment TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY(business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
      );

      INSERT INTO purchases (
        id,
        profile_id,
        business_unit_id,
        supplier_id,
        period_month,
        period_year,
        purchase_date,
        ruc,
        supplier_name,
        invoice_number,
        amount,
        payment,
        note,
        created_at,
        updated_at
      )
      SELECT
        id,
        profile_id,
        business_unit_id,
        supplier_id,
        period_month,
        period_year,
        purchase_date,
        ruc,
        supplier_name,
        invoice_number,
        amount,
        payment,
        note,
        created_at,
        updated_at
      FROM purchases_legacy;

      DROP TABLE purchases_legacy;

      CREATE INDEX IF NOT EXISTS idx_purchases_period
        ON purchases(profile_id, business_unit_id, period_year, period_month);
    `);
  }

  db.pragma("foreign_keys = ON");

  deduplicateSuppliers(db);
}

function normalizeSupplierExactKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSupplierSimilarityKey(name: string): string {
  return normalizeSupplierExactKey(name).replace(/[-_]+$/g, "");
}

function normalizeEntityName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "";
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function buildSupplierDirectoryKey(ruc: string | null | undefined, supplierName: string): string {
  const normalizedRuc = normalizeNullableText(ruc);
  if (normalizedRuc) {
    return `ruc:${normalizedRuc}`;
  }

  const normalizedName = normalizeSupplierExactKey(supplierName);
  return normalizedName ? `name:${normalizedName}` : "";
}

function normalizeAmount(value: number): string {
  return value.toFixed(2);
}

function buildPurchaseFingerprint(input: {
  periodMonth: number;
  periodYear: number;
  purchaseDate: string;
  ruc: string | null;
  supplierName: string;
  invoiceNumber: string | null;
  amount: number;
}): string {
  return [
    input.periodYear,
    input.periodMonth,
    input.purchaseDate,
    normalizeOptionalText(input.ruc),
    normalizeEntityName(input.supplierName),
    normalizeOptionalText(input.invoiceNumber).toLowerCase(),
    normalizeAmount(input.amount),
  ].join("|");
}

function parseBackupFile(content: string): BackupFile {
  const parsed = JSON.parse(content) as Partial<BackupFile>;
  if (parsed.kind !== "metrion-backup") {
    throw new Error("El archivo seleccionado no es un respaldo de Metrion.");
  }
  if (parsed.version !== 1) {
    throw new Error("La versión del respaldo no es compatible.");
  }
  if (!Array.isArray(parsed.profiles)) {
    throw new Error("El archivo de respaldo no contiene organizaciones válidas.");
  }
  return {
    kind: "metrion-backup",
    version: 1,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    profiles: parsed.profiles.map((profile) => ({
      name: String(profile.name ?? "").trim(),
      units: Array.isArray(profile.units)
        ? profile.units.map((unit) => ({
            name: String(unit.name ?? "").trim(),
            suppliers: Array.isArray(unit.suppliers) ? unit.suppliers.map((supplier) => ({
              ruc: String(supplier.ruc ?? "").trim(),
              name: String(supplier.name ?? "").trim(),
              note: supplier.note ?? null,
            })) : [],
            purchases: Array.isArray(unit.purchases) ? unit.purchases.map((purchase) => ({
              purchaseDate: String(purchase.purchaseDate ?? "").trim(),
              periodMonth: Number(purchase.periodMonth),
              periodYear: Number(purchase.periodYear),
              ruc: purchase.ruc ? String(purchase.ruc).trim() : null,
              supplierName: String(purchase.supplierName ?? "").trim(),
              invoiceNumber: purchase.invoiceNumber ? String(purchase.invoiceNumber).trim() : null,
              amount: Number(purchase.amount),
              payment: purchase.payment ? String(purchase.payment).trim() : null,
              note: purchase.note ? String(purchase.note).trim() : null,
            })) : [],
            sales: Array.isArray(unit.sales) ? unit.sales.map((sale) => ({
              periodMonth: Number(sale.periodMonth),
              periodYear: Number(sale.periodYear),
              totalAmount: Number(sale.totalAmount),
              saldoAnterior: Number(sale.saldoAnterior ?? 0),
              saldoSiguiente: Number(sale.saldoSiguiente ?? 0),
              renta: Number(sale.renta ?? 0),
              igvPago: Number(sale.igvPago ?? 0),
              baseIgvManual: sale.baseIgvManual === null || sale.baseIgvManual === undefined ? null : Number(sale.baseIgvManual),
              nota: sale.nota ? String(sale.nota).trim() : null,
            })) : [],
            closings: Array.isArray(unit.closings) ? unit.closings.map((closing) => ({
              periodMonth: Number(closing.periodMonth),
              periodYear: Number(closing.periodYear),
              isClosed: Boolean(closing.isClosed),
              closedAt: closing.closedAt ? String(closing.closedAt) : null,
              reopenedAt: closing.reopenedAt ? String(closing.reopenedAt) : null,
            })) : [],
          }))
        : [],
    })),
  };
}

function ensureBackupProfile(
  db: Database.Database,
  profileName: string,
  created: ImportBackupApplyResult["created"],
): number {
  const existing = db
    .prepare<[], { id: number; name: string }>("SELECT id, name FROM profiles")
    .all()
    .find((profile) => normalizeEntityName(profile.name) === normalizeEntityName(profileName));
  if (existing) return existing.id;

  const result = db.prepare("INSERT INTO profiles (name) VALUES (?)").run(profileName);
  created.profiles += 1;
  return Number(result.lastInsertRowid);
}

function ensureBackupUnit(
  db: Database.Database,
  profileId: number,
  unitName: string,
  created: ImportBackupApplyResult["created"],
): number {
  const existing = db
    .prepare<[number], { id: number; name: string; is_active: number }>(
      "SELECT id, name, is_active FROM business_units WHERE profile_id = ?",
    )
    .all(profileId)
    .find((unit) => normalizeEntityName(unit.name) === normalizeEntityName(unitName));
  if (existing) {
    if (!existing.is_active) {
      db.prepare(
        "UPDATE business_units SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(existing.id);
    }
    return existing.id;
  }

  const result = db
    .prepare("INSERT INTO business_units (profile_id, name) VALUES (?, ?)")
    .run(profileId, unitName);
  created.units += 1;
  return Number(result.lastInsertRowid);
}

function buildSupplierResolutionMap(db: Database.Database, profileId: number): {
  byRuc: Map<string, number>;
  byNormalizedName: Map<string, number>;
} {
  const byRuc = new Map<string, number>();
  const byNormalizedName = new Map<string, number>();

  const suppliers = db
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers WHERE profile_id = ?`,
    )
    .all(profileId);

  for (const supplier of suppliers) {
    if (supplier.ruc) {
      byRuc.set(supplier.ruc, supplier.id);
    }
    byNormalizedName.set(normalizeSupplierExactKey(supplier.name), supplier.id);
  }

  return { byRuc, byNormalizedName };
}

function ensureBackupSupplier(
  db: Database.Database,
  profileId: number,
  supplier: BackupFileUnit["suppliers"][number],
  created: ImportBackupApplyResult["created"],
): { id: number; name: string; ruc: string | null } {
  const byRuc = supplier.ruc
    ? db
        .prepare<[number, string], { id: number; name: string; ruc: string | null }>(
          "SELECT id, name, ruc FROM suppliers WHERE profile_id = ? AND ruc = ?",
        )
        .get(profileId, supplier.ruc)
    : undefined;
  if (byRuc) return byRuc;

  const byName = db
    .prepare<[number], { id: number; name: string; ruc: string | null }>(
      "SELECT id, name, ruc FROM suppliers WHERE profile_id = ?",
    )
    .all(profileId)
    .find((row) => normalizeSupplierExactKey(row.name) === normalizeSupplierExactKey(supplier.name));
  if (byName) return byName;

  const result = db
    .prepare("INSERT INTO suppliers (profile_id, ruc, name, note) VALUES (?, ?, ?, ?)")
    .run(profileId, supplier.ruc, supplier.name, supplier.note);
  created.suppliers += 1;
  return {
    id: Number(result.lastInsertRowid),
    name: supplier.name,
    ruc: supplier.ruc,
  };
}

function loadExistingPurchaseKeys(db: Database.Database, profileId: number, unitId: number): Set<string> {
  return new Set(
    db
      .prepare<[number, number], PurchaseRow>(
        `SELECT id,
                profile_id,
                business_unit_id,
                supplier_id,
                period_month,
                period_year,
                purchase_date,
                ruc,
                supplier_name,
                invoice_number,
                amount,
                payment,
                note,
                created_at,
                updated_at
         FROM purchases
         WHERE profile_id = ? AND business_unit_id = ?`,
      )
      .all(profileId, unitId)
      .map((purchase) =>
        buildPurchaseFingerprint({
          periodMonth: purchase.period_month,
          periodYear: purchase.period_year,
          purchaseDate: purchase.purchase_date,
          ruc: purchase.ruc,
          supplierName: purchase.supplier_name,
          invoiceNumber: purchase.invoice_number,
          amount: purchase.amount,
        }),
      ),
  );
}

function loadExistingSalesMap(db: Database.Database, profileId: number, unitId: number): Map<string, { id: number }> {
  return new Map(
    db
      .prepare<[number, number], { id: number; period_month: number; period_year: number }>(
        "SELECT id, period_month, period_year FROM monthly_sales WHERE profile_id = ? AND business_unit_id = ?",
      )
      .all(profileId, unitId)
      .map((sale) => [`${sale.period_year}-${sale.period_month}`, { id: sale.id }]),
  );
}

function loadExistingClosingsMap(db: Database.Database, profileId: number, unitId: number): Map<string, { id: number }> {
  return new Map(
    db
      .prepare<[number, number], { id: number; period_month: number; period_year: number }>(
        "SELECT id, period_month, period_year FROM monthly_closings WHERE profile_id = ? AND business_unit_id = ?",
      )
      .all(profileId, unitId)
      .map((closing) => [`${closing.period_year}-${closing.period_month}`, { id: closing.id }]),
  );
}

function resolveSupplierIdForPurchase(
  supplierMap: { byRuc: Map<string, number>; byNormalizedName: Map<string, number> },
  purchase: BackupFileUnit["purchases"][number],
): number | null {
  if (purchase.ruc && supplierMap.byRuc.has(purchase.ruc)) {
    return supplierMap.byRuc.get(purchase.ruc) ?? null;
  }

  return supplierMap.byNormalizedName.get(normalizeSupplierExactKey(purchase.supplierName)) ?? null;
}

function deduplicateSuppliers(db: Database.Database, profileId?: number): number {
  type SupplierRow = { id: number; profile_id: number; ruc: string | null; name: string };

  const allQuery = profileId
    ? db.prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name FROM suppliers
       WHERE profile_id = ?
       ORDER BY
         CASE WHEN ruc GLOB '[0-9]*' AND length(ruc) >= 8 THEN 0 ELSE 1 END,
         id ASC`,
    ).all(profileId)
    : db
      .prepare<[], SupplierRow>(
      `SELECT id, profile_id, ruc, name FROM suppliers
       ORDER BY
         CASE WHEN ruc GLOB '[0-9]*' AND length(ruc) >= 8 THEN 0 ELSE 1 END,
         id ASC`,
    )
      .all();

  const groups = new Map<string, SupplierRow[]>();

  for (const row of allQuery) {
    const key = `${row.profile_id}:${normalizeSupplierExactKey(row.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const updatePurchases = db.prepare(
    "UPDATE purchases SET supplier_id = ? WHERE supplier_id = ?",
  );
  const deleteSupplier = db.prepare("DELETE FROM suppliers WHERE id = ?");

  let mergedPurchases = 0;
  let mergedSuppliers = 0;

  db.transaction(() => {
    for (const [, group] of groups) {
      if (group.length <= 1) continue;

      const canonical = group[0]!;
      const removed = group.slice(1);

      for (const dup of removed) {
        const info = updatePurchases.run(canonical.id, dup.id);
        if (info.changes > 0) mergedPurchases += info.changes;
        deleteSupplier.run(dup.id);
        mergedSuppliers += 1;
      }
    }
  })();

  if (mergedPurchases > 0) {
    // Also fill missing supplier_id on purchases where supplier_name matches
    db.exec(`
      UPDATE purchases SET supplier_id = (
        SELECT s.id FROM suppliers s
        WHERE s.profile_id = purchases.profile_id
          AND LOWER(TRIM(s.name)) = LOWER(TRIM(purchases.supplier_name))
        LIMIT 1
      )
      WHERE supplier_id IS NULL
    `);
  }

  return mergedSuppliers;
}

function collectSupplierSimilarityGroups(
  db: Database.Database,
  profileId: number,
): Array<{ canonicalName: string; variants: string[] }> {
  const groups = new Map<string, Set<string>>();
  const allNames = new Set<string>();

  for (const supplier of db
    .prepare<[number], { name: string }>(
      "SELECT name FROM suppliers WHERE profile_id = ? ORDER BY LOWER(name) ASC",
    )
    .all(profileId)) {
    allNames.add(supplier.name.trim());
  }

  for (const purchase of db
    .prepare<[number], { supplier_name: string }>(
      "SELECT DISTINCT supplier_name FROM purchases WHERE profile_id = ?",
    )
    .all(profileId)) {
    allNames.add(purchase.supplier_name.trim());
  }

  for (const name of allNames) {
    const similarityKey = normalizeSupplierSimilarityKey(name);
    if (!similarityKey) continue;
    if (!groups.has(similarityKey)) {
      groups.set(similarityKey, new Set());
    }
    groups.get(similarityKey)!.add(name);
  }

  return Array.from(groups.values())
    .map((variants) => Array.from(variants).sort((left, right) => left.localeCompare(right, "es")))
    .filter((variants) => variants.length > 1)
    .map((variants) => ({
      canonicalName: variants[0] ?? "",
      variants,
    }));
}

function seed(db: Database.Database): void {
  const insertProfile = db.prepare("INSERT OR IGNORE INTO profiles (name) VALUES (?)");
  const profile = db
    .prepare<[], { id: number }>("SELECT id FROM profiles WHERE name = 'ORG_IMPORT'")
    .get();

  insertProfile.run("ORG_IMPORT");

  const profileId =
    profile?.id ??
    db
      .prepare<[], { id: number }>("SELECT id FROM profiles WHERE name = 'ORG_IMPORT'")
      .get()?.id;

  if (!profileId) {
    throw new Error("No se pudo crear el perfil inicial ORG_IMPORT.");
  }

  const insertUnit = db.prepare(
    "INSERT OR IGNORE INTO business_units (profile_id, name) VALUES (?, ?)",
  );

  for (const unit of seedUnits) {
    insertUnit.run(profileId, unit);
  }

  // Ensure all profiles have their seed units
  const allProfiles = db.prepare<[], { id: number }>("SELECT id FROM profiles").all();
  const reactivateUnit = db.prepare(
    "UPDATE business_units SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE profile_id = ? AND name = ? AND is_active = 0",
  );
  for (const p of allProfiles) {
    for (const unit of seedUnits) {
      insertUnit.run(p.id, unit);
      reactivateUnit.run(p.id, unit);
    }
  }
}

function recoverData(db: Database.Database): void {
  const refDir = path.join(process.cwd(), "docs", "metrion_reference");
  const purchasesCsv = path.join(refDir, "purchases_normalized.csv");
  const monthlyCsv = path.join(refDir, "monthly_reference.csv");

  if (!existsSync(purchasesCsv) || !existsSync(monthlyCsv)) return;

  // Skip if already seeded
  const existingCount = db.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM purchases").get()?.count ?? 0;
  if (existingCount > 0) return;

  try {
    const parseCsv = (content: string) => {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length < 2) return { headers: [] as string[], rows: [] as Record<string, string>[] };
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j] ?? "";
        rows.push(row);
      }
      return { headers, rows };
    };

    const purchasesRows = parseCsv(readFileSync(purchasesCsv, "utf8")).rows;
    const monthlyRows = parseCsv(readFileSync(monthlyCsv, "utf8")).rows;

    // Ensure profile
    const profileId = db.prepare<[], { id: number }>("SELECT id FROM profiles LIMIT 1").get()?.id;
    if (!profileId) return;

    // Ensure units
    const insertUnit = db.prepare("INSERT OR IGNORE INTO business_units (profile_id, name) VALUES (?, ?)");
    const reactivateUnit = db.prepare(
      "UPDATE business_units SET is_active = 1 WHERE profile_id = ? AND name = ? AND is_active = 0",
    );
    const unitSet = new Set<string>();
    for (const r of purchasesRows) unitSet.add(r.unit);
    for (const r of monthlyRows) unitSet.add(r.unit);
    for (const name of unitSet) {
      insertUnit.run(profileId, name);
      reactivateUnit.run(profileId, name);
    }

    // Cache unit IDs
    const unitIdCache = new Map<string, number>();
    const getUnitId = (name: string) => {
      if (unitIdCache.has(name)) return unitIdCache.get(name);
      const uid = db.prepare<[string, number], { id: number }>(
        "SELECT id FROM business_units WHERE name = ? AND profile_id = ?",
      ).get(name, profileId)?.id;
      if (uid) unitIdCache.set(name, uid);
      return uid;
    };

    // Ensure suppliers
    const insertSupplier = db.prepare("INSERT OR IGNORE INTO suppliers (profile_id, ruc, name) VALUES (?, ?, ?)");
    const supplierIds = new Map<string, number>();
    for (const r of purchasesRows) {
      if (r.ruc && r.provider) {
        insertSupplier.run(profileId, r.ruc, r.provider);
        const sid = db.prepare<[number, string], { id: number }>(
          "SELECT id FROM suppliers WHERE profile_id = ? AND ruc = ?",
        ).get(profileId, r.ruc)?.id;
        if (sid) supplierIds.set(r.ruc, sid);
      }
    }

    // Insert purchases with dedup
    const checkPurchase = db.prepare<[number, number, number, number, string, string, number], { id: number }>(
      `SELECT id FROM purchases
       WHERE profile_id = ? AND business_unit_id = ? AND period_year = ? AND period_month = ?
         AND purchase_date = ? AND supplier_name = ? AND amount = ?`,
    );
    const insertPurchase = db.prepare(`
      INSERT INTO purchases (profile_id, business_unit_id, period_month, period_year, purchase_date, ruc, supplier_name, invoice_number, amount, payment, note, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    const tx = db.transaction(() => {
      for (const r of purchasesRows) {
        const uid = getUnitId(r.unit);
        if (!uid) continue;
        const month = parseInt(r.month, 10);
        const year = parseInt(r.year, 10);
        const amount = parseFloat(r.amount);
        if (isNaN(month) || isNaN(year) || isNaN(amount)) continue;
        const date = r.date || `${year}-${String(month).padStart(2, "0")}-01`;

        const exists = checkPurchase.get(profileId, uid, year, month, date, r.provider, amount);
        if (exists) continue;

        insertPurchase.run(
          profileId, uid, month, year, date,
          r.ruc || null, r.provider, r.invoice || null,
          amount, r.payment || null, r.note || null,
          r.ruc ? (supplierIds.get(r.ruc) ?? null) : null,
        );
        inserted++;
      }
    });
    tx();

    // Upsert monthly sales
    const upsertSale = db.prepare(`
      INSERT INTO monthly_sales (profile_id, business_unit_id, period_month, period_year, total_amount, saldo_anterior, saldo_siguiente, renta, igv_pago)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
      DO UPDATE SET total_amount = excluded.total_amount, saldo_anterior = excluded.saldo_anterior,
        saldo_siguiente = excluded.saldo_siguiente, renta = excluded.renta, igv_pago = excluded.igv_pago, updated_at = CURRENT_TIMESTAMP
    `);

    let salesDone = 0;
    const tx2 = db.transaction(() => {
      for (const r of monthlyRows) {
        const uid = getUnitId(r.unit);
        if (!uid) continue;
        const month = parseInt(r.month, 10);
        const year = parseInt(r.year, 10);
        if (isNaN(month) || isNaN(year)) continue;
        const venta = parseFloat(r.venta_mes) || 0;
        if (venta <= 0) continue;
        const saldoAnt = parseFloat(r.saldo_anterior) || 0;
        const saldoSig = parseFloat(r.saldo_siguiente) || 0;
        const renta = parseFloat(r.renta) || 0;
        const igv = parseFloat(r.igv_pago) || 0;

        upsertSale.run(profileId, uid, month, year, venta, saldoAnt, saldoSig, renta, igv);
        salesDone++;
      }
    });
    tx2();

    console.log(`[recover] Inserted ${inserted} purchases, ${salesDone} monthly sales from CSVs`);

    // Verify
    const totalP = db.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM purchases").get()?.count ?? 0;
    const totalS = db.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM monthly_sales").get()?.count ?? 0;
    const unitCount = db.prepare<[string], { count: number }>(
      "SELECT COUNT(*) AS count FROM purchases WHERE business_unit_id = (SELECT id FROM business_units WHERE name = ? LIMIT 1)",
    ).get("UNIT_A")?.count ?? 0;
    console.log(`[recover] DB has ${totalP} purchases total, ${totalS} monthly sales. UNIT_A: ${unitCount} purchases`);
  } catch (err) {
    console.error("[recover] Failed:", err);
  }
}

type BusinessUnitRow = {
  id: number;
  profile_id: number;
  name: string;
  is_active: number;
};

type PurchaseRow = {
  id: number;
  profile_id: number;
  business_unit_id: number;
  supplier_id: number | null;
  period_month: number;
  period_year: number;
  purchase_date: string;
  ruc: string | null;
  supplier_name: string;
  invoice_number: string | null;
  amount: number;
  payment: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type SupplierRow = {
  id: number;
  profile_id: number;
  ruc: string | null;
  name: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type MonthlySaleRow = {
  id: number;
  profile_id: number;
  business_unit_id: number;
  period_month: number;
  period_year: number;
  total_amount: number;
  saldo_anterior: number;
  saldo_siguiente: number;
  renta: number;
  igv_pago: number;
  base_igv_manual: number | null;
  nota: string | null;
  created_at: string;
  updated_at: string;
};

type MonthlyClosingRow = {
  id: number;
  profile_id: number;
  business_unit_id: number;
  period_month: number;
  period_year: number;
  is_closed: number;
  closed_at: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapBusinessUnit(row: BusinessUnitRow): BusinessUnit {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    isActive: Boolean(row.is_active),
  };
}

function mapPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    profileId: row.profile_id,
    businessUnitId: row.business_unit_id,
    supplierId: row.supplier_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    purchaseDate: row.purchase_date,
    ruc: row.ruc,
    supplierName: row.supplier_name,
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    payment: row.payment,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    profileId: row.profile_id,
    ruc: row.ruc,
    name: row.name,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMonthlySale(row: MonthlySaleRow): MonthlySale {
  // baseIgv will be calculated by calculateMonthlySummary
  return {
    id: row.id,
    profileId: row.profile_id,
    businessUnitId: row.business_unit_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    totalAmount: row.total_amount,
    saldoAnterior: row.saldo_anterior,
    saldoSiguiente: row.saldo_siguiente,
    renta: row.renta,
    igvPago: row.igv_pago,
    baseIgv: 0,
    baseIgvManual: row.base_igv_manual,
    nota: row.nota,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMonthlyClosing(row: MonthlyClosingRow): MonthlyClosing {
  return {
    id: row.id,
    profileId: row.profile_id,
    businessUnitId: row.business_unit_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    isClosed: Boolean(row.is_closed),
    closedAt: row.closed_at,
    reopenedAt: row.reopened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.on("before-quit", closeDatabase);
