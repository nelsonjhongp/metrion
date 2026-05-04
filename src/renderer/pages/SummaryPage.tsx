import { useEffect, useState } from "react";
import type { MonthlySummary } from "../../shared/types";
import { MoneyText } from "../components/MoneyText";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";

const emptySummary: MonthlySummary = {
  totalPurchases: 0,
  totalSales: 0,
  igv: 0,
  rent: 0,
  totalToPay: 0,
  nextBalance: 0,
};

const summaryItems = [
  ["Total compras", "totalPurchases"],
  ["Total ventas", "totalSales"],
  ["IGV", "igv"],
  ["Renta", "rent"],
  ["Total a pagar", "totalToPay"],
  ["Saldo siguiente mes", "nextBalance"],
] as const;

export function SummaryPage() {
  const { businessUnitId, month, profileId, year } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<MonthlySummary>(emptySummary);

  useEffect(() => {
    async function loadSummary() {
      if (!profileId || !businessUnitId) {
        setSummary(emptySummary);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await window.metrion.getMonthlySummary({
          profileId,
          businessUnitId,
          month,
          year,
        });
        setSummary(response);
      } catch {
        setError("No se pudo cargar el resumen.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadSummary();
  }, [businessUnitId, month, profileId, year]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Resumen mensual</h1>
        {isLoading && (
          <span className="text-sm text-muted-foreground">Cargando...</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {summaryItems.map(([label, key]) => (
          <Card className="p-4" key={key}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <MoneyText
              className="mt-2 block text-2xl font-semibold"
              value={summary[key]}
            />
          </Card>
        ))}
      </div>
    </section>
  );
}

