import Database from "better-sqlite3";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "metrion.sqlite");
const REF_DIR = path.join(ROOT, "docs", "metrion_reference");
const PURCHASES_CSV = path.join(REF_DIR, "purchases_normalized.csv");
const MONTHLY_CSV = path.join(REF_DIR, "monthly_reference.csv");

const PROFILE_NAME = "ORG_IMPORT";

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0 || values.every((v) => v === "")) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const n = Number(val.trim());
  return Number.isFinite(n) ? n : null;
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === "") return null;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

interface SupplierKey {
  profileId: number;
  ruc: string;
  name: string;
}

function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const purchasesCsv = readFileSync(PURCHASES_CSV, "utf-8");
  const monthlyCsv = readFileSync(MONTHLY_CSV, "utf-8");

  const purchasesData = parseCsv(purchasesCsv);
  const monthlyData = parseCsv(monthlyCsv);

  console.log(`Parsed ${purchasesData.rows.length} purchase rows, ${monthlyData.rows.length} monthly rows`);

  // 1. Ensure profile exists
  db.prepare("INSERT OR IGNORE INTO profiles (name) VALUES (?)").run(PROFILE_NAME);
  const profileId = (
    db.prepare<[], { id: number }>("SELECT id FROM profiles WHERE name = ?").get(PROFILE_NAME)
  )!.id;
  console.log(`Profile "${PROFILE_NAME}" id=${profileId}`);

  // 2. Ensure business units exist
  const unitNames = ["UNIT_A", "UNIT_B", "UNIT_C"];
  const unitIds = new Map<string, number>();

  const insertUnit = db.prepare(
    "INSERT OR IGNORE INTO business_units (profile_id, name) VALUES (?, ?)",
  );

  for (const name of unitNames) {
    insertUnit.run(profileId, name);
    const id = (
      db.prepare<[number, string], { id: number }>(
        "SELECT id FROM business_units WHERE profile_id = ? AND name = ?",
      ).get(profileId, name)
    )!.id;
    unitIds.set(name, id);
    console.log(`Unit "${name}" id=${id}`);
  }

  // 3. Create suppliers from purchases_normalized.csv
  const supplierMap = new Map<string, SupplierKey>();
  const insertSupplier = db.prepare(
    "INSERT OR IGNORE INTO suppliers (profile_id, ruc, name) VALUES (?, ?, ?)",
  );
  const getSupplier = db.prepare<[number, string], { id: number }>(
    "SELECT id FROM suppliers WHERE profile_id = ? AND ruc = ?",
  );

  for (const row of purchasesData.rows) {
    const ruc = row["ruc"]?.trim() || "";
    const provider = row["provider"]?.trim() || "";

    if (!provider) continue;

    const lookupKey = ruc || provider;

    if (!supplierMap.has(lookupKey)) {
      insertSupplier.run(profileId, lookupKey, provider);
      const s = getSupplier.get(profileId, lookupKey);
      if (s) {
        supplierMap.set(lookupKey, { profileId, ruc: lookupKey, name: provider });
      }
    }
  }
  console.log(`Ensured ${supplierMap.size} suppliers exist`);

  // 4. Insert purchases (avoiding duplicates)
  const checkDup = db.prepare<[number, number, number, number, string, number, string], { id: number }>(
    `SELECT id FROM purchases
     WHERE profile_id = ?
       AND business_unit_id = ?
       AND period_year = ?
       AND period_month = ?
       AND invoice_number = ?
       AND amount = ?
       AND purchase_date = ?
     LIMIT 1`,
  );

  const insertPurchase = db.prepare(
    `INSERT INTO purchases (
       profile_id, business_unit_id, supplier_id,
       period_month, period_year, purchase_date,
       ruc, supplier_name, invoice_number,
       amount, payment, note
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let purchasesInserted = 0;
  let purchasesSkipped = 0;

  const insertAll = db.transaction(() => {
    for (const row of purchasesData.rows) {
      const unitName = row["unit"]?.trim() || "";
      const year = parseNumber(row["year"]);
      const month = parseNumber(row["month"]);
      const dateStr = parseDate(row["date"]);
      const ruc = row["ruc"]?.trim() || null;
      const provider = row["provider"]?.trim() || "";
      const invoice = row["invoice"]?.trim() || null;
      const amount = parseNumber(row["amount"]);
      const payment = row["payment"]?.trim() || null;
      const note = row["note"]?.trim() || null;

      if (!unitName || year === null || month === null || amount === null) {
        console.warn(`Skipping purchase row (missing fields): unit="${unitName}" y=${year} m=${month}`);
        purchasesSkipped++;
        continue;
      }

      const unitId = unitIds.get(unitName);
      if (!unitId) {
        console.warn(`Unknown unit: "${unitName}"`);
        purchasesSkipped++;
        continue;
      }

      const purchaseDate = dateStr || `${year}-${String(month).padStart(2, "0")}-01`;
      const supplierLookupKey = ruc || provider;
      const supplierId = supplierMap.get(supplierLookupKey) ? (
        getSupplier.get(profileId, supplierLookupKey)?.id ?? null
      ) : null;

      const effectiveInvoice = invoice || "";

      const existing = checkDup.get(
        profileId,
        unitId,
        year,
        month,
        effectiveInvoice,
        amount,
        purchaseDate,
      );

      if (existing) {
        purchasesSkipped++;
        continue;
      }

      insertPurchase.run(
        profileId,
        unitId,
        supplierId,
        month,
        year,
        purchaseDate,
        ruc,
        provider,
        invoice,
        amount,
        payment,
        note,
      );
      purchasesInserted++;
    }
  });

  insertAll();
  console.log(`Purchases: ${purchasesInserted} inserted, ${purchasesSkipped} skipped (duplicates/invalid)`);

  // 5. Upsert monthly_sales from monthly_reference.csv
  const upsertMonthly = db.prepare(
    `INSERT INTO monthly_sales (
       profile_id, business_unit_id,
       period_month, period_year,
       total_amount, saldo_anterior, saldo_siguiente,
       renta, igv_pago, base_igv_manual, nota
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
  );

  let monthlyInserted = 0;

  const upsertAll = db.transaction(() => {
    for (const row of monthlyData.rows) {
      const unitName = row["unit"]?.trim() || "";
      const year = parseNumber(row["year"]);
      const month = parseNumber(row["month"]);

      if (!unitName || year === null || month === null) {
        console.warn(`Skipping monthly row: unit="${unitName}" y=${year} m=${month}`);
        continue;
      }

      const unitId = unitIds.get(unitName);
      if (!unitId) {
        console.warn(`Unknown unit for monthly: "${unitName}"`);
        continue;
      }

      const totalAmount = parseNumber(row["venta_mes"]) ?? 0;
      const saldoAnterior = parseNumber(row["saldo_anterior"]) ?? 0;
      const saldoSiguiente = parseNumber(row["saldo_siguiente"]) ?? 0;
      const renta = parseNumber(row["renta"]) ?? 0;
      const igvPago = parseNumber(row["igv_pago"]) ?? 0;
      const baseIgvManual = parseNumber(row["base_igv"]);
      const nota = row["issues"]?.trim() || null;

      upsertMonthly.run(
        profileId,
        unitId,
        month,
        year,
        totalAmount,
        saldoAnterior,
        saldoSiguiente,
        renta,
        igvPago,
        baseIgvManual,
        nota,
      );
      monthlyInserted++;
    }
  });

  upsertAll();
  console.log(`Monthly sales: ${monthlyInserted} upserted`);

  db.close();
  console.log("Seed complete.");
}

main();
