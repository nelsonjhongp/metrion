import { useEffect, useState } from "react";
import { monthlySaleFormSchema } from "../../shared/sales-validation";
import { calculateMonthlySummary } from "../../shared/monthly-calculations";
import type { MonthlySaleFormValues } from "../../shared/types";
import { MoneyText } from "../components/MoneyText";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { useAppStore } from "../stores/app-store";

const emptyValues: MonthlySaleFormValues = {
  totalAmount: "",
  saldoAnterior: "",
  saldoSiguiente: "",
  renta: "",
  igvPago: "",
  baseIgv: "",
  nota: "",
};

function moneyDisplay(value: number): string {
  return value === 0 ? "" : String(value);
}

function parseMoney(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return Number(value.replace(",", ".")) || 0;
}

export function SummaryPage() {
  const {
    businessUnitId,
    closingStatus,
    month,
    profileId,
    year,
  } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MonthlySaleFormValues>(emptyValues);
  const [savedBaseIgvManual, setSavedBaseIgvManual] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [comprasMes, setComprasMes] = useState(0);
  const isClosed = closingStatus === "closed";

  useEffect(() => {
    async function loadData() {
      if (!profileId || !businessUnitId) {
        setForm(emptyValues);
        setComprasMes(0);
        return;
      }

      setIsLoading(true);
      setError(null);
      setSavedMessage(null);

      try {
        const [sale, purchasesResponse] = await Promise.all([
          window.metrion.getMonthlySale({
            profileId,
            businessUnitId,
            month,
            year,
          }),
          window.metrion.listPurchases({
            profileId,
            businessUnitId,
            month,
            year,
          }),
        ]);

        const totalCompras = purchasesResponse.totalAmount;
        setComprasMes(totalCompras);

        if (sale) {
          setSavedBaseIgvManual(sale.baseIgvManual);
          setForm({
            totalAmount: String(sale.totalAmount),
            saldoAnterior: moneyDisplay(sale.saldoAnterior),
            saldoSiguiente: moneyDisplay(sale.saldoSiguiente),
            renta: sale.renta === 0 ? "" : String(sale.renta),
            igvPago: sale.igvPago === 0 ? "" : String(sale.igvPago),
            baseIgv: sale.baseIgvManual !== null ? String(sale.baseIgvManual) : "",
            nota: sale.nota ?? "",
          });
        } else {
          let prevSaldo = 0;
          let prevMonth = month - 1;
          let prevYear = year;
          if (prevMonth < 1) {
            prevMonth = 12;
            prevYear -= 1;
          }
          const prevSale = await window.metrion.getMonthlySale({
            profileId,
            businessUnitId,
            month: prevMonth,
            year: prevYear,
          });
          if (prevSale) {
            prevSaldo = prevSale.saldoSiguiente;
          }

          const calc = calculateMonthlySummary({
            comprasMes: totalCompras,
            saldoAnterior: prevSaldo,
            ventaMes: 0,
          });

          setForm({
            totalAmount: "",
            saldoAnterior: moneyDisplay(prevSaldo),
            saldoSiguiente: moneyDisplay(calc.saldoSiguienteSugerido),
            renta: moneyDisplay(calc.rentaSugerida),
            igvPago: moneyDisplay(calc.igvPagoSugerido),
            baseIgv: "",
            nota: "",
          });
        }
      } catch {
        setError("No se pudieron cargar los datos.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [businessUnitId, month, profileId, year]);

  const currentVentaMes = parseMoney(form.totalAmount);
  const currentSaldoAnterior = parseMoney(form.saldoAnterior);
  const currentSaldoSiguienteManual = parseMoney(form.saldoSiguiente);
  const currentRentaManual = parseMoney(form.renta);
  const currentIgvPagoManual = parseMoney(form.igvPago);
  const currentBaseIgvManual = parseMoney(form.baseIgv);

  const hasManualSaldo = form.saldoSiguiente.trim().length > 0 && parseMoney(form.saldoSiguiente) > 0;
  const hasManualRenta = form.renta.trim().length > 0;
  const hasManualIgv = form.igvPago.trim().length > 0;
  const hasManualBaseIgv = form.baseIgv.trim().length > 0;

  const calc = calculateMonthlySummary({
    comprasMes,
    saldoAnterior: currentSaldoAnterior,
    ventaMes: currentVentaMes,
    rentaManual: hasManualRenta ? currentRentaManual : null,
    igvPagoManual: hasManualIgv ? currentIgvPagoManual : null,
    saldoSiguienteManual: hasManualSaldo ? currentSaldoSiguienteManual : null,
    baseIgvManual: hasManualBaseIgv ? currentBaseIgvManual : savedBaseIgvManual,
  });

  function handleFormChange(
    field: keyof MonthlySaleFormValues,
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setSavedMessage(null);
  }

  async function handleSave() {
    if (!profileId || !businessUnitId) {
      setError("Selecciona perfil y unidad.");
      return;
    }

    const parsed = monthlySaleFormSchema.safeParse(form);

    if (!parsed.success) {
      setSavedMessage(null);
      setError(parsed.error.issues[0]?.message ?? "Datos invalidos.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const baseIgvManual = hasManualBaseIgv ? currentBaseIgvManual : savedBaseIgvManual;
      const saved = await window.metrion.saveMonthlySale({
        profileId,
        businessUnitId,
        month,
        year,
        totalAmount: Number(parsed.data.totalAmount.replace(",", ".")),
        saldoAnterior: parseMoney(form.saldoAnterior),
        saldoSiguiente: parseMoney(form.saldoSiguiente),
        renta: parseMoney(form.renta),
        igvPago: parseMoney(form.igvPago),
        baseIgvManual: baseIgvManual !== 0 ? baseIgvManual : null,
        nota: emptyToNull(parsed.data.nota),
      });
      setSavedBaseIgvManual(saved.baseIgvManual);
      setForm({
        totalAmount: String(saved.totalAmount),
        saldoAnterior: moneyDisplay(saved.saldoAnterior),
        saldoSiguiente: moneyDisplay(saved.saldoSiguiente),
        renta: saved.renta === 0 ? "" : String(saved.renta),
        igvPago: saved.igvPago === 0 ? "" : String(saved.igvPago),
        baseIgv: saved.baseIgvManual !== null ? String(saved.baseIgvManual) : "",
        nota: saved.nota ?? "",
      });
      setSavedMessage("Guardado");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-4">
      <PageHeader
        actions={isLoading ? <span className="text-sm text-muted-foreground">Cargando…</span> : undefined}
        description="Ajustes y cálculo del periodo"
        title="Resumen mensual"
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {savedMessage && (
        <p className="text-sm font-medium text-emerald-700">{savedMessage}</p>
      )}

      {/* Bloque 1: Base del mes */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Base del mes</h2>
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyMoney label="Compras del mes" value={comprasMes} />
          <EditableMoney
            disabled={isClosed || isLoading}
            label="Saldo anterior"
            value={form.saldoAnterior}
            onChange={(v) => handleFormChange("saldoAnterior", v)}
          />
          <ReadOnlyMoney label="Compra base" value={calc.compraBase} />
          <EditableMoney
            disabled={isClosed || isLoading}
            label="Ventas del mes"
            value={form.totalAmount}
            onChange={(v) => handleFormChange("totalAmount", v)}
          />
        </div>
      </Card>

      {/* Bloque 2: Resultado */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Resultado</h2>
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyMoney label="Diferencia" value={calc.diferencia} />
          <div>
            <span className="text-xs text-muted-foreground">Base IGV sugerida</span>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              <MoneyText value={calc.baseIgv} />
            </p>
          </div>
          <EditableMoney
            disabled={isClosed || isLoading}
            label="Base IGV"
            value={form.baseIgv}
            onChange={(v) => handleFormChange("baseIgv", v)}
          />
          <div>
            <span className="text-xs text-muted-foreground">Saldo sugerido</span>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              <MoneyText value={calc.saldoSiguienteSugerido} />
            </p>
          </div>
          <EditableMoney
            disabled={isClosed || isLoading}
            label="Saldo para siguiente mes"
            value={form.saldoSiguiente}
            onChange={(v) => handleFormChange("saldoSiguiente", v)}
          />
        </div>
      </Card>

      {/* Bloque 3: Pago */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Pago</h2>
        <div className="grid grid-cols-2 gap-3">
          <EditableMoney
            disabled={isClosed || isLoading}
            label="Renta"
            value={form.renta}
            onChange={(v) => handleFormChange("renta", v)}
          />
          <EditableMoney
            disabled={isClosed || isLoading}
            label="IGV pago"
            value={form.igvPago}
            onChange={(v) => handleFormChange("igvPago", v)}
          />
          <ReadOnlyMoney label="Total a pagar" value={calc.totalPagar} />
          <div />
        </div>
        <div className="pt-2 border-t border-border">
          <label className="block">
            <span className="text-sm font-medium">Nota de cierre</span>
            <textarea
              className="field mt-1 h-20 resize-none py-2"
              disabled={isClosed || isLoading}
              onChange={(event) => handleFormChange("nota", event.target.value)}
              placeholder="Opcional…"
              value={form.nota}
            />
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          disabled={isClosed || isLoading || isSaving || !profileId || !businessUnitId}
          onClick={() => void handleSave()}
        >
          Guardar
        </Button>
        {isSaving && (
          <span className="text-sm text-muted-foreground">Guardando…</span>
        )}
      </div>
    </section>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ReadOnlyMoney({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        <MoneyText value={value} />
      </p>
    </div>
  );
}

function EditableMoney({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        className={cn(
          "field mt-1 text-sm",
          value.length === 0 && "text-muted-foreground/60",
        )}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00…"
        type="text"
        value={value}
      />
    </label>
  );
}
