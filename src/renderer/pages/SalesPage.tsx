import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";

export function SalesPage() {
  const isClosed = useAppStore((state) => state.closingStatus === "closed");

  return (
    <section className="max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">Ventas</h1>
      <Card className="mt-4 space-y-4 p-4">
        <label className="block">
          <span className="text-sm font-medium">Total ventas del mes</span>
          <input
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary"
            disabled={isClosed}
            inputMode="decimal"
            placeholder="0.00"
            type="text"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Observacion</span>
          <textarea
            className="mt-1 h-24 w-full resize-none rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            disabled={isClosed}
            placeholder="Opcional"
          />
        </label>
        <Button disabled={isClosed}>Guardar</Button>
      </Card>
    </section>
  );
}

