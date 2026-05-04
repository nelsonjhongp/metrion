import { BookOpen } from "lucide-react";
import { Card } from "../components/ui/card";

export function HistoryPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Historial</h1>
      <Card className="mt-4 flex flex-col items-center justify-center gap-2 p-10 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          Historial mensual
        </p>
        <p className="text-xs text-muted-foreground">
          Proximamente podras consultar meses anteriores
        </p>
      </Card>
    </section>
  );
}
