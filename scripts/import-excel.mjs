import ExcelJS from "exceljs";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INPUT_FILE = path.join(ROOT, "docs", "hojacalculo.xlsx");
const OUTPUT_DIR = path.join(ROOT, "data", "import");
const SQLITE_FILE = path.join(ROOT, "data", "metrion.sqlite");
const PROFILE_NAME = process.env.METRION_IMPORT_PROFILE_NAME?.trim() || "ORG_IMPORT";
const APPLY_SQLITE = process.argv.includes("--apply-sqlite");

const MONTHS = new Map([
  ["ENERO", 1],
  ["FEBRERO", 2],
  ["MARZO", 3],
  ["ABRIL", 4],
  ["MAYO", 5],
  ["JUNIO", 6],
  ["JULIO", 7],
  ["AGOSTO", 8],
  ["SETIEMBRE", 9],
  ["SEPTIEMBRE", 9],
  ["OCTUBRE", 10],
  ["NOVIEMBRE", 11],
  ["NOVIMBRE", 11],
  ["DICIEMBRE", 12],
  ["DICIEMBE", 12],
]);

const SUMMARY_WORDS = [
  "TOTAL",
  "COMPRA",
  "COMPRAS",
  "VENTA",
  "IGV",
  "RENTA",
  "SALDO",
  "PAGO",
  "PAGAR",
];

function cleanText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return cleanText(value.text);
    if ("result" in value) return cleanText(value.result);
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("").trim();
    }
    if ("formula" in value) return cleanText(value.result);
  }
  return String(value).trim();
}

function normalizeText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeUnitName(sheetName) {
  return cleanText(sheetName).toUpperCase();
}

function parseMonthYear(text) {
  const normalized = normalizeText(text);
  const month = [...MONTHS.entries()].find(([name]) => normalized.includes(name));
  const year = normalized.match(/\b(20\d{2})\b/)?.[1];

  if (!month || !year) {
    return null;
  }

  return {
    month: month[1],
    year: Number(year),
  };
}

function getCellValue(sheet, rowNumber, colNumber) {
  return sheet.getRow(rowNumber).getCell(colNumber).value;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cleanText(value).replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function asRuc(value) {
  const text = cleanText(value).replace(/\D/g, "");
  return text.length >= 8 && text.length <= 11 ? text : null;
}

function excelSerialToDate(serial) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;
  if (serial < 30000 || serial > 60000) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

function asDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const serialDate = excelSerialToDate(asNumber(value));
  if (serialDate) return serialDate;
  const text = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isSummaryLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return SUMMARY_WORDS.some((word) => normalized === word || normalized.startsWith(`${word} `));
}

function findMonthBlocks(sheet) {
  const blocks = [];

  for (let row = 1; row <= Math.min(sheet.rowCount, 8); row += 1) {
    for (let col = 1; col <= sheet.columnCount; col += 1) {
      const text = cleanText(getCellValue(sheet, row, col));
      const period = parseMonthYear(text);
      const normalized = normalizeText(text);
      if (period && normalized.includes("COMPRA")) {
        blocks.push({
          startCol: col,
          labelRow: row,
          label: text,
          ...period,
        });
      }
    }
  }

  return blocks
    .sort((a, b) => a.startCol - b.startCol || a.labelRow - b.labelRow)
    .filter((block, index, all) => {
      const previous = all[index - 1];
      return !previous || previous.startCol !== block.startCol;
    })
    .map((block, index, all) => ({
      ...block,
      endCol: Math.min((all[index + 1]?.startCol ?? sheet.columnCount + 1) - 1, block.startCol + 6),
    }));
}

function parsePurchaseRow(sheet, block, rowNumber, unitName, report) {
  const cells = [];
  for (let col = block.startCol; col <= block.endCol; col += 1) {
    cells.push({ col, value: getCellValue(sheet, rowNumber, col) });
  }

  if (cells.every((cell) => cleanText(cell.value) === "")) return null;

  const amountIndex = cells.findIndex((cell) => {
    const number = asNumber(cell.value);
    return number !== null && number >= 0 && number < 1_000_000;
  });

  if (amountIndex === -1) return null;

  const amount = asNumber(cells[amountIndex].value);
  const before = cells.slice(0, amountIndex);
  const after = cells.slice(amountIndex + 1);
  const supplierCell = before
    .slice()
    .reverse()
    .find((cell) => cleanText(cell.value) && !asRuc(cell.value));
  const rucCell = before.find((cell) => asRuc(cell.value));

  if (!supplierCell || isSummaryLabel(supplierCell.value)) {
    return null;
  }

  const invoiceCell = after.find((cell) => {
    const text = cleanText(cell.value);
    return text && !asDate(cell.value) && !asNumber(cell.value);
  });
  const dateCell = after.find((cell) => asDate(cell.value));
  const paymentCell = after.find((cell) => {
    if (cell === invoiceCell || cell === dateCell) return false;
    return cleanText(cell.value) !== "";
  });
  const purchaseDate = asDate(dateCell?.value);

  if (!purchaseDate) {
    report.skippedRows.push({
      reason: "missing_purchase_date",
      unit: unitName,
      sheet: sheet.name,
      row: rowNumber,
      block: block.label,
      values: cells.map((cell) => cleanText(cell.value)),
    });
    return null;
  }

  return {
    profile: PROFILE_NAME,
    unit: unitName,
    period_month: block.month,
    period_year: block.year,
    purchase_date: purchaseDate,
    ruc: asRuc(rucCell?.value),
    supplier_name: cleanText(supplierCell.value),
    invoice_number: cleanText(invoiceCell?.value) || null,
    amount,
    payment: cleanText(paymentCell?.value) || null,
    note: null,
    source: {
      sheet: sheet.name,
      row: rowNumber,
      block: block.label,
    },
  };
}

function parseMonthlySales(sheet, blocks, unitName) {
  const sales = [];

  for (const block of blocks) {
    for (let row = block.labelRow + 1; row <= sheet.rowCount; row += 1) {
      for (let col = block.startCol; col <= block.endCol; col += 1) {
        if (normalizeText(getCellValue(sheet, row, col)) !== "VENTA") continue;
        const amount = asNumber(getCellValue(sheet, row, col + 1));
        if (amount === null) continue;
        sales.push({
          profile: PROFILE_NAME,
          unit: unitName,
          period_month: block.month,
          period_year: block.year,
          total_amount: amount,
          observation: null,
          source: {
            sheet: sheet.name,
            row,
            block: block.label,
          },
        });
      }
    }
  }

  const byPeriod = new Map();
  for (const sale of sales) {
    const key = `${sale.unit}:${sale.period_year}:${sale.period_month}`;
    if (!byPeriod.has(key)) byPeriod.set(key, sale);
  }
  return [...byPeriod.values()];
}

function buildSuppliers(purchases) {
  const suppliers = new Map();
  for (const purchase of purchases) {
    if (!purchase.ruc) continue;
    const key = `${purchase.profile}:${purchase.ruc}`;
    if (!suppliers.has(key)) {
      suppliers.set(key, {
        profile: purchase.profile,
        ruc: purchase.ruc,
        name: purchase.supplier_name,
        note: null,
      });
    }
  }
  return [...suppliers.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function normalizeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(INPUT_FILE);

  const profiles = [{ name: PROFILE_NAME }];
  const businessUnits = [];
  const purchases = [];
  const monthlySales = [];
  const report = {
    input: INPUT_FILE,
    generated_at: new Date().toISOString(),
    sheets: [],
    skippedRows: [],
    warnings: [],
  };

  for (const sheet of workbook.worksheets) {
    const unitName = normalizeUnitName(sheet.name);
    businessUnits.push({ profile: PROFILE_NAME, name: unitName, is_active: true });

    const blocks = findMonthBlocks(sheet);
    report.sheets.push({
      sheet: sheet.name,
      unit: unitName,
      detectedBlocks: blocks.map(({ label, month, year, startCol, endCol }) => ({
        label,
        month,
        year,
        startCol,
        endCol,
      })),
    });

    if (blocks.length === 0) {
      report.warnings.push({ sheet: sheet.name, reason: "no_month_blocks_detected" });
      continue;
    }

    for (const block of blocks) {
      for (let row = block.labelRow + 1; row <= sheet.rowCount; row += 1) {
        const purchase = parsePurchaseRow(sheet, block, row, unitName, report);
        if (purchase) purchases.push(purchase);
      }
    }

    monthlySales.push(...parseMonthlySales(sheet, blocks, unitName));
  }

  const suppliers = buildSuppliers(purchases);
  report.counts = {
    profiles: profiles.length,
    business_units: businessUnits.length,
    suppliers: suppliers.length,
    purchases: purchases.length,
    monthly_sales: monthlySales.length,
    skipped_rows: report.skippedRows.length,
    warnings: report.warnings.length,
  };

  return {
    profiles,
    businessUnits,
    suppliers,
    purchases,
    monthlySales,
    report,
  };
}

async function writeJsonFiles(data) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeJson("profiles.json", data.profiles),
    writeJson("business_units.json", data.businessUnits),
    writeJson("suppliers.json", data.suppliers),
    writeJson("purchases.json", data.purchases),
    writeJson("monthly_sales.json", data.monthlySales),
    writeJson("import_report.json", data.report),
  ]);
}

async function writeJson(fileName, value) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function applyToSqlite(data) {
  const python = spawnSync(
    "python",
    [path.join(ROOT, "scripts", "import-json-to-sqlite.py"), SQLITE_FILE, OUTPUT_DIR],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (python.status !== 0) {
    throw new Error(python.stderr || "No se pudo importar a SQLite.");
  }

  return JSON.parse(python.stdout);
}

const data = await normalizeWorkbook();
await writeJsonFiles(data);

let sqliteResult = null;
if (APPLY_SQLITE) {
  sqliteResult = applyToSqlite(data);
}

console.log(
  JSON.stringify(
    {
      outputDir: OUTPUT_DIR,
      counts: data.report.counts,
      sqlite: sqliteResult,
    },
    null,
    2,
  ),
);
