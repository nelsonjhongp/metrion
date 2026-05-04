import { format } from "date-fns";
import {
  Check,
  Download,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { calculateMonthlySummary } from "../../shared/monthly-calculations";
import type {
  MonthlyClosingChecklist,
  MonthlySale,
  Purchase,
  PurchaseFormValues,
} from "../../shared/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoneyText } from "../components/MoneyText";
import { PurchaseDialog } from "../components/PurchaseDialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { useAppStore } from "../stores/app-store";

const MONTHS = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatPen(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function MonthlyControlPage() {
  const {
    businessUnitId,
    closingStatus,
    month,
    profileId,
    setClosingStatus,
    year,
  } = useAppStore();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [monthlySale, setMonthlySale] = useState<MonthlySale | null>(null);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [checklist, setChecklist] = useState<MonthlyClosingChecklist>({
    hasPurchases: false,
    hasSales: false,
    status: "open",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  const [saleTotal, setSaleTotal] = useState("");
  const [saleNota, setSaleNota] = useState("");
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [saleMessage, setSaleMessage] = useState<string | null>(null);

  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const isClosed = closingStatus === "closed";
  const monthName = MONTHS[month] ?? "";
  const unitName = useAppStore((s) => s.businessUnits.find((u) => u.id === s.businessUnitId)?.name ?? "");

  const loadAll = useCallback(async () => {
    if (!profileId || !businessUnitId) {
      setPurchases([]);
      setTotalPurchases(0);
      setMonthlySale(null);
      setSaldoAnterior(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [purchasesResponse, sale, closing] = await Promise.all([
        window.metrion.listPurchases({ profileId, businessUnitId, month, year }),
        window.metrion.getMonthlySale({ profileId, businessUnitId, month, year }),
        window.metrion.getClosingChecklist({ profileId, businessUnitId, month, year }),
      ]);

      setPurchases(purchasesResponse.rows);
      setTotalPurchases(purchasesResponse.totalAmount);
      setMonthlySale(sale);
      setChecklist(closing);
      setClosingStatus(closing.status);

      if (sale) {
        setSaldoAnterior(sale.saldoAnterior);
        setSaleTotal(String(sale.totalAmount));
        setSaleNota(sale.nota ?? "");
      } else {
        setSaleTotal("");
        setSaleNota("");

        let prevSaldo = 0;
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 1) {
          prevMonth = 12;
          prevYear -= 1;
        }
        try {
          const prevSale = await window.metrion.getMonthlySale({
            profileId,
            businessUnitId,
            month: prevMonth,
            year: prevYear,
          });
          if (prevSale) {
            prevSaldo = prevSale.saldoSiguiente;
          }
        } catch {
          // previous month data not available — keep 0
        }
        setSaldoAnterior(prevSaldo);
      }
    } catch {
      setError("No se pudieron cargar los datos del periodo.");
    } finally {
      setIsLoading(false);
    }
  }, [businessUnitId, month, profileId, setClosingStatus, year]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // --- Purchase handlers ---
  function openNewPurchase() {
    setEditingPurchase(null);
    setPurchaseDialogOpen(true);
  }

  function openEditPurchase(purchase: Purchase) {
    setEditingPurchase(purchase);
    setPurchaseDialogOpen(true);
  }

  async function savePurchase(values: PurchaseFormValues, supplierId?: number | null) {
    if (!profileId || !businessUnitId) {
      throw new Error("Selecciona perfil y unidad.");
    }

    const input = {
      profileId,
      businessUnitId,
      month,
      year,
      supplierId: supplierId ?? null,
      purchaseDate: values.purchaseDate,
      ruc: emptyToNull(values.ruc),
      supplierName: values.supplierName.trim(),
      invoiceNumber: emptyToNull(values.invoiceNumber),
      amount: Number(values.amount.replace(",", ".")),
      payment: emptyToNull(values.payment),
      note: emptyToNull(values.note),
    };

    if (editingPurchase) {
      await window.metrion.updatePurchase({ ...input, id: editingPurchase.id });
    } else {
      await window.metrion.createPurchase(input);
    }

    await loadAll();
  }

  async function deletePurchase(id: number) {
    try {
      await window.metrion.deletePurchase(id);
      await loadAll();
    } catch {
      setError("No se pudo eliminar la compra.");
    }
  }

  // --- Sale handler ---
  async function saveSale() {
    if (!profileId || !businessUnitId) return;

    const amount = Number(saleTotal.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      setSaleMessage("Monto invalido.");
      return;
    }

    setIsSavingSale(true);
    setSaleMessage(null);

    try {
      const saved = await window.metrion.saveMonthlySale({
        profileId,
        businessUnitId,
        month,
        year,
        totalAmount: amount,
        nota: emptyToNull(saleNota),
      });
      setMonthlySale(saved);
      setSaleTotal(String(saved.totalAmount));
      setSaleNota(saved.nota ?? "");
      setSaldoAnterior(saved.saldoAnterior);
      setSaleMessage("Venta guardada");
    } catch (saveError) {
      setSaleMessage(
        saveError instanceof Error ? saveError.message : "No se pudo guardar.",
      );
    } finally {
      setIsSavingSale(false);
    }
  }

  // --- Closing handlers ---
  async function closeMonth() {
    if (!profileId || !businessUnitId) return;

    setIsClosing(true);
    setCloseError(null);

    try {
      await window.metrion.closeMonth({ profileId, businessUnitId, month, year });
      setClosingStatus("closed");
      await loadAll();
    } catch {
      setCloseError("No se pudo cerrar el mes.");
    } finally {
      setIsClosing(false);
    }
  }

  async function reopenMonth() {
    if (!profileId || !businessUnitId) return;

    setIsClosing(true);
    setCloseError(null);

    try {
      await window.metrion.reopenMonth({ profileId, businessUnitId, month, year });
      setClosingStatus("open");
      await loadAll();
    } catch {
      setCloseError("No se pudo reabrir el mes.");
    } finally {
      setIsClosing(false);
    }
  }

  // --- Calculations ---
  const saleAmount = monthlySale ? monthlySale.totalAmount : 0;
  const calc = calculateMonthlySummary({
    comprasMes: totalPurchases,
    saldoAnterior,
    ventaMes: saleAmount,
    rentaManual: monthlySale?.renta && monthlySale.renta !== 0 ? monthlySale.renta : null,
    igvPagoManual: monthlySale?.igvPago && monthlySale.igvPago !== 0 ? monthlySale.igvPago : null,
    saldoSiguienteManual: monthlySale?.saldoSiguiente && monthlySale.saldoSiguiente !== 0 ? monthlySale.saldoSiguiente : null,
    baseIgvManual: monthlySale?.baseIgvManual,
  });

  const hasSaleManual = monthlySale !== null && monthlySale.totalAmount > 0;
  const hasManualSaldo = monthlySale !== null && monthlySale.saldoSiguiente > 0;
  const hasManualRenta = monthlySale !== null && monthlySale.renta > 0;
  const hasManualIgv = monthlySale !== null && monthlySale.igvPago > 0;
  const hasManualBaseIgv = monthlySale !== null && monthlySale.baseIgvManual !== null;

  const purchaseDateDefault = getDefaultPurchaseDate(month, year);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Control del mes
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {monthName} {year}{unitName ? ` · ${unitName}` : ""}
          </p>
        </div>
        <Button disabled size="sm" variant="secondary" title="Proximamente">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Exportar
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isClosed && (
        <div className="rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-700">
          <Lock className="mr-1.5 inline h-3.5 w-3.5" />
          Este periodo esta cerrado. Para corregir informacion, reabre el mes.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Compras del mes"
          value={formatPen(totalPurchases)}
        />
        <SummaryCard
          label="Ventas del mes"
          value={hasSaleManual ? formatPen(saleAmount) : "\u2014"}
          muted={!hasSaleManual}
        />
        <SummaryCard
          label="Saldo anterior"
          value={formatPen(saldoAnterior)}
        />
        <SummaryCard
          label="Total a pagar"
          value={formatPen(calc.totalPagar)}
          accent
        />
        <SummaryCard
          label="Estado"
          value={isClosed ? "Cerrado" : "Abierto"}
          statusBadge={isClosed ? "closed" : "open"}
        />
      </div>

      {/* No profile/unit guard */}
      {(!profileId || !businessUnitId) && (
        <Card className="flex flex-col items-center justify-center gap-1 p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Selecciona perfil y unidad
          </p>
          <p className="text-xs text-muted-foreground">
            Usa los filtros superiores para continuar
          </p>
        </Card>
      )}

      {/* Main two-column layout */}
      {profileId && businessUnitId && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: Purchases */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Compras del mes</h2>
                <Button
                  disabled={isClosed || !profileId || !businessUnitId}
                  onClick={openNewPurchase}
                  size="sm"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Nueva compra
                </Button>
              </div>

              {isLoading ? (
                <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  Cargando...
                </div>
              ) : purchases.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Aun no hay compras registradas este mes
                  </p>
                  {!isClosed && (
                    <Button
                      disabled={!profileId || !businessUnitId}
                      onClick={openNewPurchase}
                      size="sm"
                      variant="secondary"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Registrar primera compra
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">
                            Fecha
                          </th>
                          <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">
                            Proveedor
                          </th>
                          <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground">
                            Factura
                          </th>
                          <th className="h-9 px-4 text-right text-xs font-medium text-muted-foreground">
                            Monto
                          </th>
                          <th className="h-9 px-4 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">
                            Pago
                          </th>
                          <th className="h-9 w-20" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {purchases.map((p) => (
                          <tr
                            className="hover:bg-muted/30 transition-colors"
                            key={p.id}
                          >
                            <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                              {format(new Date(`${p.purchaseDate}T12:00:00`), "dd/MM/yyyy")}
                            </td>
                            <td className="px-4 py-2 font-medium max-w-[180px] truncate">
                              {p.supplierName}
                            </td>
                            <td className="px-4 py-2">
                              {p.invoiceNumber ? (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                  {p.invoiceNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">\u2014</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-medium">
                              <MoneyText value={p.amount} />
                            </td>
                            <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell max-w-[120px] truncate text-xs">
                              {p.payment || "\u2014"}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex justify-center gap-0.5">
                                <Button
                                  disabled={isClosed}
                                  onClick={() => openEditPurchase(p)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <ConfirmDialog
                                  confirmLabel="Eliminar"
                                  description="Esta compra se eliminara del mes."
                                  onConfirm={() => void deletePurchase(p.id)}
                                  title="Eliminar compra"
                                >
                                  <Button
                                    disabled={isClosed}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </ConfirmDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {purchases.length} {purchases.length === 1 ? "compra" : "compras"}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        Total compras
                      </span>
                      <span className="text-lg font-bold tabular-nums text-foreground">
                        <MoneyText value={totalPurchases} />
                      </span>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Right: Sale + Summary + Closing */}
          <div className="space-y-4">
            {/* Sale input */}
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Venta del mes</h3>
              <label className="block">
                <span className="text-xs text-muted-foreground">Monto total</span>
                <input
                  className="field mt-1"
                  disabled={isClosed || isLoading}
                  inputMode="decimal"
                  onChange={(e) => {
                    setSaleTotal(e.target.value);
                    setSaleMessage(null);
                  }}
                  placeholder="0.00"
                  type="text"
                  value={saleTotal}
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Nota (opcional)</span>
                <input
                  className="field mt-1"
                  disabled={isClosed || isLoading}
                  onChange={(e) => {
                    setSaleNota(e.target.value);
                    setSaleMessage(null);
                  }}
                  placeholder="Ej: ventas gamarra"
                  type="text"
                  value={saleNota}
                />
              </label>
              <div className="flex items-center gap-3">
                <Button
                  disabled={isClosed || isLoading || isSavingSale || !profileId || !businessUnitId}
                  onClick={() => void saveSale()}
                  size="sm"
                >
                  Guardar venta
                </Button>
                {saleMessage && (
                  <span className={cn(
                    "text-xs font-medium",
                    saleMessage === "Venta guardada"
                      ? "text-emerald-700"
                      : "text-red-600",
                  )}>
                    {saleMessage}
                  </span>
                )}
              </div>
            </Card>

            {/* Fiscal summary */}
            <Card className="p-4 space-y-2.5">
              <h3 className="text-sm font-semibold">Resumen del mes</h3>
              <div className="space-y-1.5">
                <SummaryRow label="Compras del mes" value={totalPurchases} />
                <SummaryRow label="Saldo anterior" value={saldoAnterior} />
                <SummaryRow label="Compra base" value={calc.compraBase} highlight />
                <SummaryRow label="Venta del mes" value={saleAmount} />
                <div className="my-1.5 border-t border-border" />
                <SummaryRow label="Diferencia" value={calc.diferencia} sign />
                <SummaryRow label="Base IGV" value={calc.baseIgv} manual={hasManualBaseIgv} />
                <SummaryRow label="Saldo siguiente" value={calc.saldoSiguiente} manual={hasManualSaldo} />
                <div className="my-1.5 border-t border-border" />
                <SummaryRow label="Renta" value={calc.renta} manual={hasManualRenta} />
                <SummaryRow label="IGV" value={calc.igvPago} manual={hasManualIgv} />
                <div className="my-1 border-t border-border" />
                <SummaryRow label="Total a pagar" value={calc.totalPagar} bold accent />
              </div>
            </Card>

            {/* Closing */}
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Cierre del mes</h3>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estado</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    isClosed
                      ? "bg-stone-200 text-stone-700"
                      : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {isClosed ? (
                    <>
                      <Lock className="h-3 w-3" />
                      Cerrado
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3 w-3" />
                      Abierto
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-1.5">
                <CheckItem done={checklist.hasPurchases} label="Compras registradas" />
                <CheckItem done={checklist.hasSales} label="Ventas registradas" />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {isClosed ? (
                  <Button
                    disabled={isClosing || !profileId || !businessUnitId}
                    onClick={() => void reopenMonth()}
                    size="sm"
                    variant="secondary"
                  >
                    Reabrir mes
                  </Button>
                ) : (
                  <ConfirmDialog
                    confirmLabel="Cerrar mes"
                    description={`\u00bfCerrar ${monthName} ${year}? Despues de cerrar, las compras y ventas del periodo quedaran bloqueadas.`}
                    onConfirm={() => void closeMonth()}
                    title={`Cerrar ${monthName} ${year}`}
                  >
                    <Button
                      disabled={isClosing || !profileId || !businessUnitId}
                      size="sm"
                    >
                      Cerrar mes
                    </Button>
                  </ConfirmDialog>
                )}
                {isClosing && (
                  <span className="text-xs text-muted-foreground">Procesando...</span>
                )}
              </div>
              {closeError && (
                <p className="text-xs text-red-600">{closeError}</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Purchase dialog */}
      <PurchaseDialog
        defaultDate={purchaseDateDefault}
        onOpenChange={setPurchaseDialogOpen}
        onSubmit={savePurchase}
        open={purchaseDialogOpen}
        profileId={profileId}
        purchase={editingPurchase}
      />
    </div>
  );
}

// ---- Sub-components ----

function SummaryCard({
  label,
  value,
  muted,
  accent,
  statusBadge,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
  statusBadge?: "open" | "closed";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 bg-white",
        accent && "border-emerald-300",
        statusBadge === "open" && "border-emerald-200",
        statusBadge === "closed" && "border-stone-300",
        !accent && !statusBadge && "border-border",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums",
          muted && "text-muted-foreground",
          accent && "text-emerald-700 text-lg",
          statusBadge === "open" && "text-emerald-700",
          statusBadge === "closed" && "text-stone-600",
          !muted && !accent && !statusBadge && "text-foreground text-base",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  manual,
  highlight,
  bold,
  accent,
  sign,
}: {
  label: string;
  value: number;
  manual?: boolean;
  highlight?: boolean;
  bold?: boolean;
  accent?: boolean;
  sign?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {manual !== undefined && (
          <span
            className={cn(
              "rounded-sm border px-1 text-[10px] font-medium leading-tight",
              manual
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-transparent bg-stone-100 text-stone-500",
            )}
          >
            {manual ? "Manual" : "Calc"}
          </span>
        )}
        <span
          className={cn(
            "tabular-nums text-sm",
            highlight && "font-semibold text-foreground",
            bold && "text-base font-bold text-foreground",
            accent && "text-base font-bold text-emerald-700",
            sign && value < 0 && "text-red-600",
          )}
        >
          <MoneyText value={value} />
        </span>
      </div>
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-3 w-3 text-emerald-600" />
        </div>
      ) : (
        <div className="h-4 w-4 rounded-full border border-stone-200" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

// ---- Helpers ----

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getDefaultPurchaseDate(month: number, year: number): string {
  const today = new Date();

  if (today.getMonth() + 1 === month && today.getFullYear() === year) {
    return format(today, "yyyy-MM-dd");
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}
