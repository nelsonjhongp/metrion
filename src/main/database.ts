import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  AppContext,
  BusinessUnit,
  ClosingStatus,
  ClosingStatusQuery,
  MonthlyClosing,
  MonthlyClosingChecklist,
  MonthlyClosingQuery,
  MonthlySale,
  MonthlySaleInput,
  MonthlySaleQuery,
  MonthlySummary,
  MonthlySummaryQuery,
  MonthlyPurchases,
  Profile,
  Purchase,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
  Supplier,
  SupplierInput,
  SupplierLookupQuery,
  SupplierQuery,
  SupplierUpdateInput,
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

const seedUnits = [
  "UNIT_A",
  "UNIT_B",
  "UNIT_C",
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
       ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      safeInput.profileId,
      safeInput.businessUnitId,
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

  return getDatabase()
    .prepare<[number], SupplierRow>(
      `SELECT id, profile_id, ruc, name, note, created_at, updated_at
       FROM suppliers
       WHERE profile_id = ?
       ORDER BY name ASC, ruc ASC`,
    )
    .all(safeQuery.profileId)
    .map(mapSupplier);
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

  try {
    const result = getDatabase()
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

    return getSupplierById(Number(result.lastInsertRowid));
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export function updateSupplier(input: SupplierUpdateInput): Supplier {
  const safeInput = supplierUpdateInputSchema.parse(input);

  try {
    const result = getDatabase()
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
              observation,
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
         observation
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
       DO UPDATE SET
         total_amount = excluded.total_amount,
         observation = excluded.observation,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(
      safeInput.profileId,
      safeInput.businessUnitId,
      safeInput.month,
      safeInput.year,
      safeInput.totalAmount,
      safeInput.observation ?? null,
    );

  const saved = getMonthlySale(safeInput);

  if (!saved) {
    throw new Error("No se pudo guardar la venta.");
  }

  return saved;
}

export function getMonthlySummary(query: MonthlySummaryQuery): MonthlySummary {
  const safeQuery = monthlySaleQuerySchema.parse(query);
  const db = getDatabase();
  const totalPurchases =
    db
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
  const totalSales =
    db
      .prepare<
        [number, number, number, number],
        { total_amount: number | null }
      >(
        `SELECT COALESCE(total_amount, 0) AS total_amount
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
      )?.total_amount ?? 0;
  const igv = totalSales * 0.18;
  const rent = totalSales * 0.015;
  const totalToPay = igv + rent;
  const nextBalance = totalSales - totalPurchases - totalToPay;

  return {
    totalPurchases: roundMoney(totalPurchases),
    totalSales: roundMoney(totalSales),
    igv: roundMoney(igv),
    rent: roundMoney(rent),
    totalToPay: roundMoney(totalToPay),
    nextBalance: roundMoney(nextBalance),
  };
}

export function getAppContext(): AppContext {
  const profiles = listProfiles();
  const selectedProfileId = profiles[0]?.id ?? null;
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
    return new Error("Ya existe un proveedor con ese RUC.");
  }

  return error instanceof Error ? error : new Error("Operacion invalida.");
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
      ruc TEXT NOT NULL,
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
      observation TEXT,
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
  ruc: string;
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
  observation: string | null;
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
  return {
    id: row.id,
    profileId: row.profile_id,
    businessUnitId: row.business_unit_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    totalAmount: row.total_amount,
    observation: row.observation,
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
