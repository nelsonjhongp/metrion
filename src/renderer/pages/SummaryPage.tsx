import { Card } from "../components/ui/card";
import { MoneyText } from "../components/MoneyText";

const items = [
  ["Total compras", 0],
  ["Total ventas", 0],
  ["IGV", 0],
  ["Renta", 0],
  ["Total a pagar", 0],
  ["Saldo siguiente mes", 0],
] as const;

export function SummaryPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Resumen mensual</h1>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {items.map(([label, value]) => (
          <Card className="p-4" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <MoneyText className="mt-2 block text-2xl font-semibold" value={value} />
          </Card>
        ))}
      </div>
    </section>
  );
}

