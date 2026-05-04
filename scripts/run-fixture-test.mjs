import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { calculateMonthlySummary } from "../src/shared/monthly-calculations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testCasesPath = join(
  __dirname,
  "../docs/metrion_reference/monthly_test_cases.json"
);

const rawData = readFileSync(testCasesPath, "utf-8");
const testData = JSON.parse(rawData);

let passed = 0;
let failed = 0;

function assert(label, actual, expected, tolerance = 0.01) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} → expected ${expected}, got ${actual}`);
  }
}

function test(name, fn) {
  const prevFailed = failed;
  fn();
  if (failed === prevFailed) {
    console.log(`  PASS: ${name}`);
  }
}

console.log(`Running ${testData.testCases.length} test cases from monthly_test_cases.json\n`);

for (const tc of testData.testCases) {
  test(tc.name, () => {
    const result = calculateMonthlySummary({
      comprasMes: tc.input.comprasMes,
      saldoAnterior: tc.input.saldoAnterior,
      ventaMes: tc.input.ventaMes,
      rentaManual: tc.input.rentaManual ?? undefined,
      igvPagoManual: tc.input.igvPagoManual ?? undefined,
      saldoSiguienteManual: tc.input.saldoSiguienteManual ?? undefined,
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
process.exit(failed > 0 ? 1 : 0);
