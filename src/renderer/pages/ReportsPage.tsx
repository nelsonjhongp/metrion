import { ChartBar } from "lucide-react";
import { Card } from "../components/ui/card";

export function ReportsPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
      <Card className="mt-4 flex flex-col items-center justify-center gap-2 p-10 text-center">
        <ChartBar className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          Reportes y exportaciones
        </p>
        <p className="text-xs text-muted-foreground">
          Proximamente podras generar resumenes y exportar datos
        </p>
      </Card>
    </section>
  );
}
