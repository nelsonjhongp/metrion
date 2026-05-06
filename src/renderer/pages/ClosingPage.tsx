import { useEffect, useState } from "react";
import type { MonthlyClosingChecklist } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";

const emptyChecklist: MonthlyClosingChecklist = {
  hasPurchases: false,
  hasSales: false,
  status: "open",
};

export function ClosingPage() {
  const {
    businessUnitId,
    closingStatus,
    month,
    profileId,
    setClosingStatus,
    year,
  } = useAppStore();
  const [checklist, setChecklist] =
    useState<MonthlyClosingChecklist>(emptyChecklist);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isClosed = closingStatus === "closed";

  async function loadChecklist() {
    if (!profileId || !businessUnitId) {
      setChecklist(emptyChecklist);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.metrion.getClosingChecklist({
        profileId,
        businessUnitId,
        month,
        year,
      });
      setChecklist(response);
      setClosingStatus(response.status);
    } catch {
      setError("No se pudo cargar el cierre.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadChecklist();
  }, [businessUnitId, month, profileId, year]);

  async function closeSelectedMonth() {
    if (!profileId || !businessUnitId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await window.metrion.closeMonth({
        profileId,
        businessUnitId,
        month,
        year,
      });
      setClosingStatus("closed");
      await loadChecklist();
    } catch {
      setError("No se pudo cerrar el mes.");
    } finally {
      setIsSaving(false);
    }
  }

  async function reopenSelectedMonth() {
    if (!profileId || !businessUnitId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await window.metrion.reopenMonth({
        profileId,
        businessUnitId,
        month,
        year,
      });
      setClosingStatus("open");
      await loadChecklist();
    } catch {
      setError("No se pudo reabrir el mes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="max-w-lg space-y-4">
      <PageHeader
        description="Validación y estado del periodo"
        title="Cierre de mes"
      />
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estado</span>
          <Badge variant={isClosed ? "danger" : "success"}>
            {isClosed ? "cerrado" : "abierto"}
          </Badge>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            checked={checklist.hasPurchases}
            className="h-4 w-4"
            disabled
            readOnly
            type="checkbox"
          />
          compras registradas
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            checked={checklist.hasSales}
            className="h-4 w-4"
            disabled
            readOnly
            type="checkbox"
          />
          ventas registradas
        </label>
        <div className="flex items-center gap-2 pt-2">
          <Button
            disabled={isClosed || isLoading || isSaving || !profileId || !businessUnitId}
            onClick={() => void closeSelectedMonth()}
          >
            Cerrar mes
          </Button>
          <Button
            disabled={!isClosed || isLoading || isSaving || !profileId || !businessUnitId}
            onClick={() => void reopenSelectedMonth()}
            variant="secondary"
          >
            Reabrir mes
          </Button>
          {isLoading && (
            <span className="text-sm text-muted-foreground">Cargando…</span>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>
    </section>
  );
}
