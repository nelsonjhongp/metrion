import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";

export function ClosingPage() {
  const closingStatus = useAppStore((state) => state.closingStatus);
  const isClosed = closingStatus === "closed";

  return (
    <section className="max-w-lg">
      <h1 className="text-xl font-semibold tracking-tight">Cierre de mes</h1>
      <Card className="mt-4 space-y-4 p-4">
        <label className="flex items-center gap-3 text-sm">
          <input className="h-4 w-4" disabled type="checkbox" />
          compras registradas
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input className="h-4 w-4" disabled type="checkbox" />
          ventas registradas
        </label>
        <div className="flex gap-2 pt-2">
          <Button disabled={isClosed}>Cerrar mes</Button>
          <Button disabled={!isClosed} variant="secondary">
            Reabrir mes
          </Button>
        </div>
      </Card>
    </section>
  );
}

