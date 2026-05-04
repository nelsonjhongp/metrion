import { useEffect, useState } from "react";
import { monthlySaleFormSchema } from "../../shared/sales-validation";
import type { MonthlySaleFormValues } from "../../shared/types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";

const emptyValues: MonthlySaleFormValues = {
  totalAmount: "",
  observation: "",
};

export function SalesPage() {
  const {
    businessUnitId,
    closingStatus,
    month,
    profileId,
    year,
  } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MonthlySaleFormValues>(emptyValues);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const isClosed = closingStatus === "closed";

  useEffect(() => {
    async function loadSale() {
      if (!profileId || !businessUnitId) {
        setForm(emptyValues);
        return;
      }

      setIsLoading(true);
      setError(null);
      setSavedMessage(null);

      try {
        const sale = await window.metrion.getMonthlySale({
          profileId,
          businessUnitId,
          month,
          year,
        });
        setForm(
          sale
            ? {
                totalAmount: String(sale.totalAmount),
                observation: sale.observation ?? "",
              }
            : emptyValues,
        );
      } catch {
        setError("No se pudieron cargar las ventas.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadSale();
  }, [businessUnitId, month, profileId, year]);

  async function saveSale() {
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
      const saved = await window.metrion.saveMonthlySale({
        profileId,
        businessUnitId,
        month,
        year,
        totalAmount: Number(parsed.data.totalAmount.replace(",", ".")),
        observation: emptyToNull(parsed.data.observation),
      });
      setForm({
        totalAmount: String(saved.totalAmount),
        observation: saved.observation ?? "",
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
    <section className="max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">Ventas</h1>
      <Card className="mt-4 space-y-4 p-4">
        <label className="block">
          <span className="text-sm font-medium">Total ventas del mes</span>
          <input
            className="field mt-1"
            disabled={isClosed || isLoading}
            inputMode="decimal"
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                totalAmount: event.target.value,
              }));
              setSavedMessage(null);
            }}
            placeholder="0.00"
            type="text"
            value={form.totalAmount}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Observacion</span>
          <textarea
            className="field mt-1 h-24 resize-none py-2"
            disabled={isClosed || isLoading}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                observation: event.target.value,
              }));
              setSavedMessage(null);
            }}
            placeholder="Opcional"
            value={form.observation}
          />
        </label>
        <div className="flex items-center gap-3">
          <Button
            disabled={isClosed || isLoading || isSaving}
            onClick={() => void saveSale()}
          >
            Guardar
          </Button>
          {isLoading && (
            <span className="text-sm text-muted-foreground">Cargando...</span>
          )}
          {savedMessage && (
            <span className="text-sm font-medium text-emerald-700">
              {savedMessage}
            </span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </Card>
    </section>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

