import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  AppContext,
  BusinessUnit,
  ClosingStatus,
  ClosingStatusQuery,
  MonthlyPurchases,
  Profile,
  Purchase,
  PurchaseInput,
  PurchaseQuery,
  PurchaseUpdateInput,
} from "../shared/types";
import {
  purchaseInputSchema,
  purchaseQuerySchema,
  purchaseUpdateInputSchema,
} from "../shared/purchase-validation";

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

app.on("before-quit", closeDatabase);
