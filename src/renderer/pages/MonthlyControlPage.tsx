import { format } from "date-fns";
import {
  Check,
  FileSpreadsheet,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateMonthlySummary } from "../../shared/monthly-calculations";
import { monthlySaleFormSchema } from "../../shared/sales-validation";
import type {
  MonthlyClosingChecklist,
  MonthlySale,
  MonthlySaleFormValues,
  Purchase,
  PurchaseFormValues,
} from "../../shared/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoneyText } from "../components/MoneyText";
import { PageHeader } from "../components/PageHeader";
import { PurchaseDialog } from "../components/PurchaseDialog";
import { TablePaginationControls } from "../components/TablePaginationControls";
import { TableToolbar, TableToolbarField } from "../components/TableToolbar";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";
import { useAppStore } from "../stores/app-store";

const MONTHS = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatPen(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function moneyDisplay(value: number): string {
  return value === 0 ? "" : String(value);
}

function parseMoney(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return Number(value.replace(",", ".")) || 0;
}

type MonthlyControlPageProps = {
  onOpenSupplierCatalogFromPurchase: () => void;
};

export function MonthlyControlPage({ onOpenSupplierCatalogFromPurchase }: MonthlyControlPageProps) {
  const {
    businessUnitId,
    closingStatus,
    month,
    purchaseSupplierFlow,
    profileId,
    clearPurchaseSupplierFlow,
    acknowledgePurchaseSupplierFlowResume,
    startPurchaseSupplierFlow,
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
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePageSize, setPurchasePageSize] = useState(10);

  const [saleTotal, setSaleTotal] = useState("");
  const [saleNota, setSaleNota] = useState("");
  const [adjustForm, setAdjustForm] = useState<Pick<MonthlySaleFormValues, "saldoSiguiente" | "renta" | "igvPago" | "baseIgv">>({
    saldoSiguiente: "",
    renta: "",
    igvPago: "",
    baseIgv: "",
  });
  const [savedBaseIgvManual, setSavedBaseIgvManual] = useState<number | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const adjustRef = useRef<HTMLDivElement>(null);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [saleMessage, setSaleMessage] = useState<string | null>(null);

  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const isClosed = closingStatus === "closed";
  const readyToClose = checklist.hasPurchases && checklist.hasSales && !isClosed;
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
        const autoCalc = calculateMonthlySummary({
          comprasMes: purchasesResponse.totalAmount,
          saldoAnterior: sale.saldoAnterior,
          ventaMes: sale.totalAmount,
        });
        setSaldoAnterior(sale.saldoAnterior);
        setSaleTotal(String(sale.totalAmount));
        setSaleNota(sale.nota ?? "");
        setSavedBaseIgvManual(sale.baseIgvManual);
        setAdjustForm({
          saldoSiguiente: Math.abs(sale.saldoSiguiente - autoCalc.saldoSiguienteSugerido) > 0.009 ? moneyDisplay(sale.saldoSiguiente) : "",
          renta: Math.abs(sale.renta - autoCalc.rentaSugerida) > 0.009 ? String(sale.renta) : "",
          igvPago: Math.abs(sale.igvPago - autoCalc.igvPagoSugerido) > 0.009 ? String(sale.igvPago) : "",
          baseIgv: sale.baseIgvManual !== null ? String(sale.baseIgvManual) : "",
        });
      } else {
        setSaleTotal("");
        setSaleNota("");
        setSavedBaseIgvManual(null);
        setAdjustForm({
          saldoSiguiente: "",
          renta: "",
          igvPago: "",
          baseIgv: "",
        });

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

  useEffect(() => {
    if (
      purchaseSupplierFlow?.resumeRequested &&
      purchaseSupplierFlow.returnPage === "control"
    ) {
      setEditingPurchase(purchaseSupplierFlow.purchase);
      setPurchaseDialogOpen(true);
      acknowledgePurchaseSupplierFlowResume();
    }
  }, [acknowledgePurchaseSupplierFlowResume, purchaseSupplierFlow]);

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

    clearPurchaseSupplierFlow();
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

    setIsSavingSale(true);
    setSaleMessage(null);

    try {
      const saved = await persistMonthlySale();
      const autoCalc = calculateMonthlySummary({
        comprasMes: totalPurchases,
        saldoAnterior: saved.saldoAnterior,
        ventaMes: saved.totalAmount,
      });
      setMonthlySale(saved);
      setSaleTotal(String(saved.totalAmount));
      setSaleNota(saved.nota ?? "");
      setSaldoAnterior(saved.saldoAnterior);
      setSavedBaseIgvManual(saved.baseIgvManual);
      setAdjustForm({
        saldoSiguiente: Math.abs(saved.saldoSiguiente - autoCalc.saldoSiguienteSugerido) > 0.009 ? moneyDisplay(saved.saldoSiguiente) : "",
        renta: Math.abs(saved.renta - autoCalc.rentaSugerida) > 0.009 ? String(saved.renta) : "",
        igvPago: Math.abs(saved.igvPago - autoCalc.igvPagoSugerido) > 0.009 ? String(saved.igvPago) : "",
        baseIgv: saved.baseIgvManual !== null ? String(saved.baseIgvManual) : "",
      });
      setAdjustOpen(false);
      setSaleMessage("Venta guardada");
    } catch (saveError) {
      setSaleMessage(
        saveError instanceof Error ? saveError.message : "No se pudo guardar.",
      );
    } finally {
      setIsSavingSale(false);
    }
  }

  async function persistMonthlySale(): Promise<MonthlySale> {
    if (!profileId || !businessUnitId) {
      throw new Error("Selecciona perfil y unidad.");
    }

    const formData: MonthlySaleFormValues = {
      totalAmount: saleTotal,
      saldoAnterior: moneyDisplay(saldoAnterior),
      saldoSiguiente: adjustForm.saldoSiguiente,
      renta: adjustForm.renta,
      igvPago: adjustForm.igvPago,
      baseIgv: adjustForm.baseIgv,
      nota: saleNota,
    };

    const parsed = monthlySaleFormSchema.safeParse(formData);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
    }

    const normalizedSaleTotal = saleTotal.trim();
    if (normalizedSaleTotal.length === 0) {
      throw new Error("Ingresa el total de ventas del mes.");
    }

    const amount = Number(normalizedSaleTotal.replace(",", "."));
    const autoCalc = calculateMonthlySummary({
      comprasMes: totalPurchases,
      saldoAnterior,
      ventaMes: amount,
    });

    const manualBaseIgv = adjustForm.baseIgv.trim().length > 0
      ? parseMoney(adjustForm.baseIgv)
      : savedBaseIgvManual;

    const saved = await window.metrion.saveMonthlySale({
      profileId,
      businessUnitId,
      month,
      year,
      totalAmount: amount,
      saldoAnterior,
      saldoSiguiente: resolveManualValue(
        adjustForm.saldoSiguiente,
        monthlySale?.saldoSiguiente ?? autoCalc.saldoSiguiente,
        autoCalc.saldoSiguienteSugerido,
      ),
      renta: resolveManualValue(
        adjustForm.renta,
        monthlySale?.renta ?? autoCalc.renta,
        autoCalc.rentaSugerida,
      ),
      igvPago: resolveManualValue(
        adjustForm.igvPago,
        monthlySale?.igvPago ?? autoCalc.igvPago,
        autoCalc.igvPagoSugerido,
      ),
      baseIgvManual: manualBaseIgv !== 0 ? manualBaseIgv : null,
      nota: emptyToNull(saleNota),
    });

    return saved;
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

  // --- Export handler ---
  async function handleExport() {
    if (!profileId || !businessUnitId) return;

    setIsExporting(true);
    setExportMessage(null);

    try {
      const result = await window.metrion.exportMonthlyXlsx({
        profileId,
        businessUnitId,
        month,
        year,
        unitName,
        monthName,
      });

      if (result.success) {
        setExportMessage("Exportado correctamente");
      } else if (result.error) {
        setExportMessage(result.error);
      }
    } catch {
      setExportMessage("No se pudo exportar.");
    } finally {
      setIsExporting(false);
    }
  }

  // --- Calculations ---
  const saleAmount = monthlySale ? monthlySale.totalAmount : 0;
  const baseAutoCalc = calculateMonthlySummary({
    comprasMes: totalPurchases,
    saldoAnterior,
    ventaMes: saleAmount,
  });

  const currentBaseIgvManual = adjustForm.baseIgv.trim().length > 0
    ? parseMoney(adjustForm.baseIgv)
    : savedBaseIgvManual;
  const currentSaldoManual = resolveCurrentManualValue(
    adjustForm.saldoSiguiente,
    monthlySale?.saldoSiguiente ?? null,
    baseAutoCalc.saldoSiguienteSugerido,
  );
  const currentRentaManual = resolveCurrentManualValue(
    adjustForm.renta,
    monthlySale?.renta ?? null,
    baseAutoCalc.rentaSugerida,
  );
  const currentIgvManual = resolveCurrentManualValue(
    adjustForm.igvPago,
    monthlySale?.igvPago ?? null,
    baseAutoCalc.igvPagoSugerido,
  );

  const calc = calculateMonthlySummary({
    comprasMes: totalPurchases,
    saldoAnterior,
    ventaMes: saleAmount,
    rentaManual: currentRentaManual,
    igvPagoManual: currentIgvManual,
    saldoSiguienteManual: currentSaldoManual,
    baseIgvManual: currentBaseIgvManual,
  });

  const hasSaleManual = monthlySale !== null && monthlySale.totalAmount > 0;
  const hasManualSaldo = currentSaldoManual !== null;
  const hasManualRenta = currentRentaManual !== null;
  const hasManualIgv = currentIgvManual !== null;
  const hasManualBaseIgv = currentBaseIgvManual !== null;

  const purchaseDateDefault = getDefaultPurchaseDate(month, year);
  const filteredPurchases = useMemo(() => {
    const query = purchaseSearch.trim().toLowerCase();
    if (!query) return purchases;

    return purchases.filter((purchase) =>
      [
        purchase.purchaseDate,
        purchase.ruc ?? "",
        purchase.supplierName,
        purchase.invoiceNumber ?? "",
        purchase.payment ?? "",
        purchase.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [purchaseSearch, purchases]);
  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / purchasePageSize));
  const currentPurchasePage = Math.min(purchasePage, purchaseTotalPages);
  const visiblePurchases = filteredPurchases.slice(
    (currentPurchasePage - 1) * purchasePageSize,
    currentPurchasePage * purchasePageSize,
  );

  useEffect(() => {
    setPurchasePage(1);
  }, [purchasePageSize, purchaseSearch, month, year, businessUnitId]);

  return (
    <div className="space-y-4">
      <PageHeader
        actions={(
          <div className="flex flex-col items-end gap-1 pt-0.5">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isExporting || !profileId || !businessUnitId}
              onClick={() => void handleExport()}
              size="sm"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              {isExporting ? "Exportando…" : "Exportar"}
            </Button>
            {exportMessage && (
              <span
                aria-live="polite"
                className={cn(
                  "text-xs",
                  exportMessage === "Exportado correctamente"
                    ? "text-success-foreground"
                    : "text-danger-foreground",
                )}
              >
                {exportMessage}
              </span>
            )}
          </div>
        )}
        description="Seguimiento y cierre del periodo"
        title="Control del mes"
      />

      {error && <Alert aria-live="polite" variant="danger">{error}</Alert>}

      {isClosed && (
        <Alert variant="default">
          <Lock aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
          Este periodo esta cerrado. Para corregir informacion, reabre el mes.
        </Alert>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <div className="grid gap-4 lg:grid-cols-[2.05fr_1fr]">
          {/* Left: Purchases */}
          <div className="space-y-4">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-[1.05rem] font-semibold tracking-tight">Compras del mes</h2>
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
                <div className="space-y-3 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
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
                  <TableToolbar className="border-b-0 bg-transparent px-4 pb-2 pt-0">
                    <TableToolbarField className="min-w-[240px] flex-1" label="Buscar">
                      <input
                        className="field h-9"
                        onChange={(event) => setPurchaseSearch(event.target.value)}
                        placeholder="Proveedor, factura, RUC o pago…"
                        value={purchaseSearch}
                      />
                    </TableToolbarField>
                  </TableToolbar>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface">
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
                        {visiblePurchases.map((p) => (
                          <tr
                            className="hover:bg-muted/30 transition-colors"
                            key={p.id}
                          >
                            <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                              {format(new Date(`${p.purchaseDate}T12:00:00`), "dd/MM/yyyy")}
                            </td>
                            <td className="max-w-[180px] px-4 py-2 font-medium truncate">
                              {p.supplierName}
                            </td>
                            <td className="px-4 py-2">
                              {p.invoiceNumber ? (
                                <Badge variant="secondary">
                                  {p.invoiceNumber}
                                </Badge>
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
                                  aria-label="Editar compra"
                                  disabled={isClosed}
                                  onClick={() => openEditPurchase(p)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                                </Button>
                                <ConfirmDialog
                                  confirmLabel="Eliminar"
                                  description="Esta compra se eliminara del mes."
                                  onConfirm={() => void deletePurchase(p.id)}
                                  title="Eliminar compra"
                                >
                                  <Button
                                    aria-label="Eliminar compra"
                                    disabled={isClosed}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                                  </Button>
                                </ConfirmDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {filteredPurchases.length} {filteredPurchases.length === 1 ? "compra" : "compras"}
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
                  <TablePaginationControls
                    itemLabel="compras"
                    onPageChange={setPurchasePage}
                    onPageSizeChange={setPurchasePageSize}
                    page={currentPurchasePage}
                    pageSize={purchasePageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    totalItems={filteredPurchases.length}
                  />
                </>
              )}
            </Card>
          </div>

          {/* Right: Sale + Summary + Closing */}
          <div className="space-y-3">
            {/* Sale input */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold tracking-tight">Venta del mes</h3>
                <Button
                  disabled={isClosed || isLoading || isSavingSale || !profileId || !businessUnitId}
                  onClick={() => void saveSale()}
                  size="sm"
                >
                  Guardar venta
                </Button>
              </div>
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
                  placeholder="0.00…"
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
                  placeholder="Ej: ventas gamarra…"
                  type="text"
                  value={saleNota}
                />
              </label>
              <div className="flex items-center gap-3">
                {saleMessage && (
                  <span aria-live="polite" className={cn(
                    "text-xs font-medium",
                    saleMessage === "Venta guardada"
                      ? "text-success-foreground"
                      : "text-danger-foreground",
                  )}>
                    {saleMessage}
                  </span>
                )}
              </div>
            </Card>

            {/* Fiscal summary */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold tracking-tight">Resumen del mes</h3>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    setAdjustOpen((current) => {
                      if (!current) setTimeout(() => adjustRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                      return !current;
                    });
                  }}
                  size="sm"
                >
                  Ajustar
                </Button>
              </div>
              <div className="space-y-1.5">
                <SummaryRow label="Compras del mes" value={totalPurchases} />
                <SummaryRow label="Saldo anterior" value={saldoAnterior} />
                <SummaryRow label="Compra base" value={calc.compraBase} highlight />
                <SummaryRow label="Venta del mes" value={saleAmount} />
                <Separator className="my-1.5" />
                <SummaryRow label="Diferencia" value={calc.diferencia} sign />
                <SummaryRow label="Base IGV" value={calc.baseIgv} manual={hasManualBaseIgv} />
                <SummaryRow label="Saldo siguiente" value={calc.saldoSiguiente} manual={hasManualSaldo} />
                <Separator className="my-1.5" />
                <SummaryRow label="Renta" value={calc.renta} manual={hasManualRenta} />
                <SummaryRow label="IGV" value={calc.igvPago} manual={hasManualIgv} />
                <Separator className="my-1" />
                <SummaryRow label="Total a pagar" value={calc.totalPagar} bold accent />
              </div>
              {adjustOpen && (
                <div ref={adjustRef}>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-3">
                    <AdjustField
                      label="Base IGV"
                      value={adjustForm.baseIgv}
                      onChange={(value) => setAdjustForm((current) => ({ ...current, baseIgv: value }))}
                      placeholder={moneyDisplay(baseAutoCalc.baseIgv)}
                      disabled={isClosed || isLoading}
                    />
                    <AdjustField
                      label="Saldo siguiente"
                      value={adjustForm.saldoSiguiente}
                      onChange={(value) => setAdjustForm((current) => ({ ...current, saldoSiguiente: value }))}
                      placeholder={moneyDisplay(baseAutoCalc.saldoSiguienteSugerido)}
                      disabled={isClosed || isLoading}
                    />
                    <AdjustField
                      label="Renta"
                      value={adjustForm.renta}
                      onChange={(value) => setAdjustForm((current) => ({ ...current, renta: value }))}
                      placeholder={moneyDisplay(baseAutoCalc.rentaSugerida)}
                      disabled={isClosed || isLoading}
                    />
                    <AdjustField
                      label="IGV"
                      value={adjustForm.igvPago}
                      onChange={(value) => setAdjustForm((current) => ({ ...current, igvPago: value }))}
                      placeholder={moneyDisplay(baseAutoCalc.igvPagoSugerido)}
                      disabled={isClosed || isLoading}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Deja vacío un campo para usar el cálculo automático.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAdjustForm({
                            saldoSiguiente: "",
                            renta: "",
                            igvPago: "",
                            baseIgv: "",
                          });
                          setSavedBaseIgvManual(null);
                        }}
                      >
                        Limpiar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void saveSale()}
                        disabled={isClosed || isLoading || isSavingSale}
                      >
                        Guardar ajustes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Closing */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold tracking-tight">Cierre del mes</h3>
                <Badge
                  variant={
                    isClosed ? "neutral" : readyToClose ? "success" : "warning"
                  }
                >
                  {isClosed ? "Cerrado" : readyToClose ? "Listo" : "Pendiente"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estado</span>
                <Badge variant={isClosed ? "neutral" : "success"}>
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
                </Badge>
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
                  <span className="text-xs text-muted-foreground">Procesando…</span>
                )}
              </div>
              {closeError && (
                <p className="text-xs text-danger-foreground">{closeError}</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Purchase dialog */}
      <PurchaseDialog
        defaultDate={purchaseDateDefault}
        draftValues={
          purchaseSupplierFlow?.returnPage === "control"
            ? purchaseSupplierFlow.values
            : null
        }
        initialSupplierId={
          purchaseSupplierFlow?.returnPage === "control"
            ? purchaseSupplierFlow.supplierId
            : null
        }
        onCancel={clearPurchaseSupplierFlow}
        onCreateSupplierInCatalog={(draft) => {
          startPurchaseSupplierFlow({
            ...draft,
            returnPage: "control",
          });
          onOpenSupplierCatalogFromPurchase();
        }}
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
        "rounded-xl border bg-card px-4 py-3.5 shadow-sm",
        accent && "border-success",
        statusBadge === "open" && "border-success",
        statusBadge === "closed" && "border-border",
        !accent && !statusBadge && "border-border",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-semibold tabular-nums",
          muted && "text-muted-foreground",
          accent && "text-lg text-success-foreground",
          !muted && !accent && !statusBadge && "text-foreground text-base",
        )}
      >
        {statusBadge ? (
          <Badge variant={statusBadge === "open" ? "success" : "neutral"}>
            {value}
          </Badge>
        ) : (
          value
        )}
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
          <Badge variant={manual ? "warning" : "secondary"} className="text-[10px]">
            {manual ? "Manual" : "Calc"}
          </Badge>
        )}
        <span
          className={cn(
            "tabular-nums text-sm",
            highlight && "font-semibold text-foreground",
            bold && "text-base font-bold text-foreground",
            accent && "text-base font-bold text-success-foreground",
            sign && value < 0 && "text-danger-foreground",
          )}
        >
          <MoneyText value={value} />
        </span>
      </div>
    </div>
  );
}

function AdjustField({
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        className="field mt-1 h-9"
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </label>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
          <Check className="h-3 w-3 text-success-foreground" />
        </div>
      ) : (
        <div className="h-4 w-4 rounded-full border border-border" />
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

function resolveCurrentManualValue(
  currentText: string,
  savedValue: number | null,
  suggestedValue: number,
): number | null {
  if (currentText.trim().length > 0) {
    return parseMoney(currentText);
  }

  if (savedValue === null) {
    return null;
  }

  return Math.abs(savedValue - suggestedValue) > 0.009 ? savedValue : null;
}

function resolveManualValue(
  currentText: string,
  savedValue: number,
  suggestedValue: number,
): number {
  if (currentText.trim().length > 0) {
    return parseMoney(currentText);
  }

  if (Math.abs(savedValue - suggestedValue) > 0.009) {
    return savedValue;
  }

  return suggestedValue;
}
