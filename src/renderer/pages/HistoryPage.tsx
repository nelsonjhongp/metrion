import { FileSpreadsheet, Lock, Unlock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MonthlyPeriodSummary } from "../../shared/types";
import { MoneyText } from "../components/MoneyText";
import { PageHeader } from "../components/PageHeader";
import { TablePaginationControls } from "../components/TablePaginationControls";
import { TableToolbar, TableToolbarField } from "../components/TableToolbar";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useAppStore } from "../stores/app-store";

const MONTHS = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function HistoryPage() {
  const { businessUnitId, profileId, year: currentYear } = useAppStore();
  const [periods, setPeriods] = useState<MonthlyPeriodSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [yearFilter, setYearFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const unitName = useAppStore(
    (s) =>
      s.businessUnits.find((u) => u.id === s.businessUnitId)?.name ?? "",
  );

  const loadPeriods = useCallback(async () => {
    if (!profileId || !businessUnitId) {
      setPeriods([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rows = await window.metrion.listMonthlyPeriods({
        profileId,
        businessUnitId,
      });
      setPeriods(rows);
    } catch {
      setError("No se pudieron cargar los periodos.");
    } finally {
      setIsLoading(false);
    }
  }, [businessUnitId, profileId]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search, statusFilter, yearFilter]);

  async function handleExport(month: number, year: number) {
    if (!profileId || !businessUnitId) return;

    setIsExporting(true);
    setExportMessage(null);

    try {
      const monthName = MONTHS[month] ?? "";
      const result = await window.metrion.exportMonthlyXlsx({
        profileId,
        businessUnitId,
        month,
        year,
        unitName,
        monthName,
      });

      if (result.success) {
        setExportMessage(`${monthName} ${year}: exportado`);
      } else if (result.error) {
        setExportMessage(result.error);
      }
    } catch {
      setExportMessage("Error al exportar.");
    } finally {
      setIsExporting(false);
    }
  }

  const yearOptions = useMemo(
    () => Array.from(new Set(periods.map((period) => String(period.year)))).sort((a, b) => Number(b) - Number(a)),
    [periods],
  );

  const filteredPeriods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periods.filter((period) => {
      if (statusFilter !== "all") {
        const expectedClosed = statusFilter === "closed";
        if (period.isClosed !== expectedClosed) return false;
      }

      if (yearFilter !== "all" && String(period.year) !== yearFilter) {
        return false;
      }

      if (!query) return true;
      const periodLabel = `${MONTHS[period.month]} ${period.year}`.toLowerCase();
      return periodLabel.includes(query);
    });
  }, [periods, search, statusFilter, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPeriods.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedPeriods = filteredPeriods.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!profileId || !businessUnitId) {
    return (
      <section className="max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">Historial</h1>
        <Card className="mt-4 flex flex-col items-center justify-center gap-2 p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Selecciona perfil y unidad
          </p>
          <p className="text-xs text-muted-foreground">
            Usa los filtros superiores para continuar
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="max-w-3xl space-y-4">
      <PageHeader
        description="Periodos anteriores"
        title="Historial"
      />

      {exportMessage && (
        <Alert
          aria-live="polite"
          variant={exportMessage.includes("exportado") ? "success" : "danger"}
        >
          {exportMessage}
        </Alert>
      )}

      {error && (
        <Alert aria-live="polite" variant="danger">{error}</Alert>
      )}

      <Card className="overflow-hidden">
        <TableToolbar>
          <TableToolbarField className="min-w-[220px] flex-1" label="Buscar">
            <input
              className="field h-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mes o año…"
              value={search}
            />
          </TableToolbarField>
          <TableToolbarField className="min-w-[140px]" label="Estado">
            <select
              className="select-field h-9 px-3 text-sm"
              onChange={(event) => setStatusFilter(event.target.value as "all" | "open" | "closed")}
              value={statusFilter}
            >
              <option value="all">Todos</option>
              <option value="open">Abiertos</option>
              <option value="closed">Cerrados</option>
            </select>
          </TableToolbarField>
          <TableToolbarField className="min-w-[120px]" label="Año">
            <select
              className="select-field h-9 px-3 text-sm"
              onChange={(event) => setYearFilter(event.target.value)}
              value={yearFilter}
            >
              <option value="all">Todos</option>
              {yearOptions.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ))}
            </select>
          </TableToolbarField>
        </TableToolbar>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : filteredPeriods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin periodos para los filtros actuales
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20 text-center">Exportar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedPeriods.map((p) => {
                const isCurrent =
                  p.month === new Date().getMonth() + 1 &&
                  p.year === currentYear;
                return (
                  <TableRow key={`${p.year}-${p.month}`}>
                    <TableCell className="font-medium">
                      {MONTHS[p.month]} {p.year}
                      {isCurrent && (
                        <Badge className="ml-2" variant="secondary">
                          Actual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyText value={p.totalPurchases} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.totalSales > 0 ? (
                        <MoneyText value={p.totalSales} />
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {p.totalPagar > 0 ? (
                        <MoneyText value={p.totalPagar} />
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      {p.isClosed ? (
                        <Badge variant="neutral">
                          <Lock className="h-3 w-3" />
                          Cerrado
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <Unlock className="h-3 w-3" />
                          Abierto
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        aria-label={`Exportar ${MONTHS[p.month]} ${p.year}`}
                        disabled={isExporting}
                        onClick={() => void handleExport(p.month, p.year)}
                        size="sm"
                        title={`Exportar ${MONTHS[p.month]} ${p.year}`}
                        variant="ghost"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!isLoading && (
          <TablePaginationControls
            itemLabel="periodos"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={filteredPeriods.length}
          />
        )}
      </Card>
    </section>
  );
}
