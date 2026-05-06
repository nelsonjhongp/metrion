import { CalendarDays, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { ImportDialog } from "../components/ImportDialog";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import { useAppStore } from "../stores/app-store";

const YEARS: number[] = (() => {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 3; y <= current + 0; y++) {
    years.push(y);
  }
  return years;
})();

export function ReportsPage() {
  const { businessUnitId, profileId, year: currentYear } = useAppStore();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const unitName = useAppStore(
    (s) =>
      s.businessUnits.find((u) => u.id === s.businessUnitId)?.name ?? "",
  );

  async function handleExportYear() {
    if (!profileId || !businessUnitId) return;

    setIsExporting(true);
    setMessage(null);

    try {
      const result = await window.metrion.exportYearlyXlsx({
        profileId,
        businessUnitId,
        year: selectedYear,
        unitName,
      });

      if (result.success) {
        setMessage(`Año ${selectedYear}: exportado correctamente`);
      } else if (result.error) {
        setMessage(result.error);
      }
    } catch {
      setMessage("Error al exportar.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!profileId || !businessUnitId) {
    return (
      <section className="max-w-lg">
        <h1 className="text-xl font-semibold tracking-tight">Excel</h1>
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
    <section className="max-w-[1040px] space-y-4">
      <PageHeader
        description="Exportación e ingreso mensual de datos"
        title="Excel"
      />

      {message && (
        <div
          aria-live="polite"
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm font-medium",
            message.includes("correctamente")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600",
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
        <Card className="rounded-xl border-border/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#ecf7f1] text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[1.1rem] font-semibold tracking-tight text-foreground">Exportar a Excel</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Descarga los datos del sistema en un archivo Excel.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-foreground">Año a exportar</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  className="select-field h-11 w-full rounded-lg pl-10 pr-4 text-sm font-medium"
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  value={selectedYear}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              className="mt-2 h-10 rounded-lg"
              disabled={isExporting || !profileId || !businessUnitId}
              onClick={() => void handleExportYear()}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {isExporting ? `Exportando ${selectedYear}…` : `Exportar ${selectedYear}`}
            </Button>
          </div>
        </Card>

        <Card className="rounded-xl border-border/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#2f6fdb]">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[1.1rem] font-semibold tracking-tight text-foreground">Cargar Excel mensual</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Importa un archivo Excel para actualizar los datos del sistema.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-[#bfd6ff] bg-[#fbfdff] px-5 py-5 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-[1.02rem] font-semibold tracking-tight text-foreground">
                Arrastra y suelta tu archivo aquí
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                O selecciona un archivo desde tu dispositivo para importar compras y ventas mensuales.
              </p>

              <Button
                className="mt-5 h-9 rounded-lg px-5"
                disabled={!profileId || !businessUnitId}
                onClick={() => setImportDialogOpen(true)}
                variant="secondary"
              >
                <Upload className="mr-2 h-4 w-4" />
                Seleccionar archivo
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ImportDialog
        open={importDialogOpen}
        profileId={profileId}
        businessUnitId={businessUnitId}
        onOpenChange={setImportDialogOpen}
      />
    </section>
  );
}
