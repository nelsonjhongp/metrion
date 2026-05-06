import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { ImportApplyResult, ImportMonthPreview, ImportPreview } from "../../shared/types";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type ImportDialogProps = {
  open: boolean;
  profileId: number | null;
  businessUnitId: number | null;
  onOpenChange: (open: boolean) => void;
};

export function ImportDialog({ open, profileId, businessUnitId, onOpenChange }: ImportDialogProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<ImportApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectFile() {
    if (!profileId || !businessUnitId) return;
    setIsLoading(true);
    setError(null);
    setPreview(null);
    setSelected(new Set());

    try {
      const p = await window.metrion.importPreview({ profileId, businessUnitId });
      if (!p.sessionId) {
        setError(p.warnings[0] ?? "No se pudo leer el archivo.");
        return;
      }
      setPreview(p);
      setSelected(new Set(p.months.map((m) => `${m.year}-${m.month}`)));
    } catch {
      setError("Error al leer el archivo.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleMonth(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApply() {
    if (!preview || !profileId || !businessUnitId) return;
    setIsApplying(true);
    setResult(null);
    setError(null);

    try {
      const r = await window.metrion.importApply({
        sessionId: preview.sessionId,
        profileId,
        businessUnitId,
        selectedMonths: [...selected].map((k) => {
          const [y, m] = k.split("-").map(Number);
          return { month: m, year: y };
        }),
      });
      setResult(r);
    } catch {
      setError("Error al aplicar la importación.");
    } finally {
      setIsApplying(false);
    }
  }

  function handleClose() {
    setPreview(null);
    setSelected(new Set());
    setResult(null);
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }} open={open}>
      <DialogContent className="w-[560px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Cargar Excel mensual</DialogTitle>
        </DialogHeader>

          {!preview ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona el archivo mensual.
              </p>
              {error && <Alert variant="danger">{error}</Alert>}
              <Button disabled={isLoading || !profileId || !businessUnitId} onClick={() => void handleSelectFile()}>
                {isLoading ? "Leyendo archivo…" : "Seleccionar archivo"}
              </Button>
            </div>
          ) : result ? (
            <div className="mt-4 space-y-3">
              <Alert variant="success">
                <p className="text-sm font-medium">Importación completada</p>
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  <li>{result.inserted.purchases} compras insertadas</li>
                  <li>{result.inserted.sales} ventas actualizadas</li>
                  <li>{result.inserted.suppliers} proveedores nuevos</li>
                </ul>
              </Alert>
              {result.errors.length > 0 && (
                <Alert variant="danger" className="text-xs">{result.errors.join("; ")}</Alert>
              )}
              <div className="flex justify-end">
                <Button variant="secondary" onClick={handleClose}>Cerrar</Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-sm font-medium">{preview.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.unitName} · {preview.totalMonths} meses
                </p>
              </div>

              {preview.warnings.length > 0 && (
                <Alert className="p-3" variant="warning">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs">{preview.warnings.join("; ")}</span>
                  </div>
                </Alert>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Meses detectados</p>
                {preview.months.map((m: ImportMonthPreview) => {
                  const key = `${m.year}-${m.month}`;
                  return (
                    <label
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/30"
                      key={key}
                    >
                      <input
                        checked={selected.has(key)}
                        className="h-4 w-4"
                        onChange={() => toggleMonth(key)}
                        type="checkbox"
                      />
                      <span className="flex-1 font-medium">{m.monthName} {m.year}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.purchaseCount} compras · S/ {m.totalPurchases.toFixed(2)}
                        {m.totalSales > 0 ? ` · S/ ${m.totalSales.toFixed(2)}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                <Button
                  disabled={isApplying || selected.size === 0}
                  onClick={() => void handleApply()}
                >
                  {isApplying ? "Importando…" : `Importar ${selected.size} mes(es)`}
                </Button>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
