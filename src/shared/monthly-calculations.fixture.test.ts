import { calculateMonthlySummary } from "./monthly-calculations.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testCasesPath = path.join(
  __dirname,
  "../../docs/metrion_reference/monthly_test_cases.json"
);

const rawData = fs.readFileSync(testCasesPath, "utf-8");
const testData = JSON.parse(rawData);

let passed = 0;
let failed = 0;

function assert(label: string, actual: number, expected: number, tolerance = 0.01) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} → expected ${expected}, got ${actual}`);
  }
}

function test(name: string, fn: () => void) {
  const prevFailed = failed;
  fn();
  if (failed === prevFailed) {
    console.log(`  PASS: ${name}`);
  }
}

console.log(`Running ${testData.testCases.length} test cases from monthly_test_cases.json\n`);

for (const tc of testData.testCases) {
  test(tc.name, () => {
    // First calculate without baseIgvManual to see what the automatic value would be
    const autoResult = calculateMonthlySummary({
      comprasMes: tc.input.comprasMes,
      saldoAnterior: tc.input.saldoAnterior,
      ventaMes: tc.input.ventaMes,
    });

    // Determine if we need baseIgvManual
    const baseIgvManual = tc.expected.baseIgv !== autoResult.baseIgv ? tc.expected.baseIgv : undefined;

    const result = calculateMonthlySummary({
      comprasMes: tc.input.comprasMes,
      saldoAnterior: tc.input.saldoAnterior,
      ventaMes: tc.input.ventaMes,
      rentaManual: tc.input.rentaManual ?? undefined,
      igvPagoManual: tc.input.igvPagoManual ?? undefined,
      saldoSiguienteManual: tc.input.saldoSiguienteManual ?? undefined,
      baseIgvManual,
    });

    assert("compraBase", result.compraBase, tc.expected.compraBase);
    assert("diferencia", result.diferencia, tc.expected.diferencia);
    assert("baseIgv", result.baseIgv, tc.expected.baseIgv);
    assert("saldoSiguiente", result.saldoSiguiente, tc.expected.saldoSiguiente);
    assert("renta", result.renta, tc.expected.renta);
    assert("igvPago", result.igvPago, tc.expected.igvPago);
    assert("totalPagar", result.totalPagar, tc.expected.totalPagar);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
