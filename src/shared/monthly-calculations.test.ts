import { calculateMonthlySummary } from "./monthly-calculations";

let passed = 0;
let failed = 0;

function assert(label: string, actual: number, expected: number, tolerance = 0.01) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} → expected ${expected}, got ${actual}`);
  }
}

function test(name: string, fn: () => void) {
  const prevFailed = failed;
  fn();
  if (failed === prevFailed) {
    console.log(`PASS: ${name}`);
  }
}

// UNIT_A febrero 2026
test("UNIT_A feb 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 25065.10, saldoAnterior: 1449, ventaMes: 26006 });
  assert("compraBase", r.compraBase, 26514.10);
  assert("diferencia", r.diferencia, -508.10);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 508.10);
  assert("rentaSugerida", r.rentaSugerida, 331);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 331);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 331);
});

// UNIT_A marzo 2026
test("UNIT_A mar 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 35273.06, saldoAnterior: 508, ventaMes: 34364 });
  assert("compraBase", r.compraBase, 35781.06);
  assert("diferencia", r.diferencia, -1417.06);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 1417.06);
  assert("rentaSugerida", r.rentaSugerida, 437);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 437);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 437);
});

// UNIT_A abril 2026
test("UNIT_A abr 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 27252.66, saldoAnterior: 1414, ventaMes: 29077 });
  assert("compraBase", r.compraBase, 28666.66);
  assert("diferencia", r.diferencia, 410.34);
  assert("baseIgv", r.baseIgv, 410.34);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 0);
  assert("rentaSugerida", r.rentaSugerida, 370);
  assert("igvPagoSugerido", r.igvPagoSugerido, 63);
  assert("renta (auto)", r.renta, 370);
  assert("igvPago (auto)", r.igvPago, 63);
  assert("totalPagar (auto)", r.totalPagar, 433);
});

// UNIT_B febrero 2026
test("UNIT_B feb 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 5790, saldoAnterior: 819, ventaMes: 6482 });
  assert("compraBase", r.compraBase, 6609);
  assert("diferencia", r.diferencia, -127);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 127);
  assert("rentaSugerida", r.rentaSugerida, 82);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 82);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 82);
});

// UNIT_B marzo 2026
test("UNIT_B mar 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 6084.60, saldoAnterior: 127, ventaMes: 5859 });
  assert("compraBase", r.compraBase, 6211.60);
  assert("diferencia", r.diferencia, -352.60);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 352.60);
  assert("rentaSugerida", r.rentaSugerida, 74);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 74);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 74);
});

// UNIT_B abril 2026
test("UNIT_B abr 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 3814.62, saldoAnterior: 352.60, ventaMes: 3962 });
  assert("compraBase", r.compraBase, 4167.22);
  assert("diferencia", r.diferencia, -205.22);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 205.22);
  assert("rentaSugerida", r.rentaSugerida, 50);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 50);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 50);
});

// UNIT_C febrero 2026
test("UNIT_C feb 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 14943, saldoAnterior: 2075, ventaMes: 17077 });
  assert("compraBase", r.compraBase, 17018);
  assert("diferencia", r.diferencia, 59);
  assert("baseIgv", r.baseIgv, 59);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 0);
  assert("rentaSugerida", r.rentaSugerida, 217);
  assert("igvPagoSugerido", r.igvPagoSugerido, 9);
  assert("renta (auto)", r.renta, 217);
  assert("igvPago (auto)", r.igvPago, 9);
  assert("totalPagar (auto)", r.totalPagar, 226);
});

// UNIT_C marzo 2026
test("UNIT_C mar 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 16452.40, saldoAnterior: 0, ventaMes: 14013 });
  assert("compraBase", r.compraBase, 16452.40);
  assert("diferencia", r.diferencia, -2439.40);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 2439.40);
  assert("rentaSugerida", r.rentaSugerida, 178);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 178);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 178);
});

// UNIT_C abril 2026
test("UNIT_C abr 2026", () => {
  const r = calculateMonthlySummary({ comprasMes: 8299.10, saldoAnterior: 2439.40, ventaMes: 9447 });
  assert("compraBase", r.compraBase, 10738.50);
  assert("diferencia", r.diferencia, -1291.50);
  assert("baseIgv", r.baseIgv, 0);
  assert("saldoSiguienteSugerido", r.saldoSiguienteSugerido, 1291.50);
  assert("rentaSugerida", r.rentaSugerida, 120);
  assert("igvPagoSugerido", r.igvPagoSugerido, 0);
  assert("renta (auto)", r.renta, 120);
  assert("igvPago (auto)", r.igvPago, 0);
  assert("totalPagar (auto)", r.totalPagar, 120);
});

// Manual override test
test("Manual override respects user values", () => {
  const r = calculateMonthlySummary({
    comprasMes: 1000,
    saldoAnterior: 0,
    ventaMes: 2000,
    rentaManual: 30,
    igvPagoManual: 50,
    saldoSiguienteManual: 200,
  });
  assert("renta (manual)", r.renta, 30);
  assert("igvPago (manual)", r.igvPago, 50);
  assert("saldoSiguiente (manual)", r.saldoSiguiente, 200);
  assert("totalPagar (manual)", r.totalPagar, 80);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
