function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundInt(value: number): number {
  return Math.round(value);
}

export type MonthlyCalculationInput = {
  comprasMes: number;
  saldoAnterior: number;
  ventaMes: number;
  rentaManual?: number | null;
  igvPagoManual?: number | null;
  saldoSiguienteManual?: number | null;
  baseIgvManual?: number | null;
};

export type MonthlyCalculationOutput = {
  comprasMes: number;
  saldoAnterior: number;
  ventaMes: number;
  compraBase: number;
  diferencia: number;
  baseIgv: number;
  saldoSiguienteSugerido: number;
  saldoSiguiente: number;
  rentaSugerida: number;
  renta: number;
  igvPagoSugerido: number;
  igvPago: number;
  totalPagar: number;
};

export function calculateMonthlySummary(
  input: MonthlyCalculationInput,
): MonthlyCalculationOutput {
  const { comprasMes, saldoAnterior, ventaMes } = input;

  const compraBase = roundMoney(comprasMes + saldoAnterior);
  const diferencia = roundMoney(ventaMes - compraBase);

  let baseIgvSugerida: number;
  let saldoSiguienteSugerido: number;
  let igvPagoSugerido: number;

  if (diferencia >= 0) {
    baseIgvSugerida = roundMoney(diferencia);
    saldoSiguienteSugerido = 0;
  } else {
    baseIgvSugerida = 0;
    saldoSiguienteSugerido = roundMoney(Math.abs(diferencia));
  }

  const baseIgv = input.baseIgvManual ?? baseIgvSugerida;
  igvPagoSugerido = baseIgv >= 0 ? roundInt((baseIgv / 1.18) * 0.18) : 0;

  const rentaSugerida = roundInt((ventaMes / 1.18) * 0.015);

  const renta = input.rentaManual ?? rentaSugerida;
  const igvPago = input.igvPagoManual ?? igvPagoSugerido;
  const saldoSiguiente =
    input.saldoSiguienteManual ?? saldoSiguienteSugerido;

  const totalPagar = roundMoney(renta + igvPago);

  return {
    comprasMes,
    saldoAnterior,
    ventaMes,
    compraBase,
    diferencia,
    baseIgv,
    saldoSiguienteSugerido,
    saldoSiguiente,
    rentaSugerida,
    renta,
    igvPagoSugerido,
    igvPago,
    totalPagar,
  };
}
