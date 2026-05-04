import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { MoneyText } from "../components/MoneyText";
import { useAppStore } from "../stores/app-store";

type PurchaseRow = {
  date: string;
  ruc: string;
  supplier: string;
  invoice: string;
  amount: number;
  payment: string;
  note: string;
};

const columns: DataTableColumn<PurchaseRow>[] = [
  { key: "date", header: "Fecha", render: (row) => row.date },
  { key: "ruc", header: "RUC", render: (row) => row.ruc },
  { key: "supplier", header: "Proveedor", render: (row) => row.supplier },
  { key: "invoice", header: "Factura", render: (row) => row.invoice },
  {
    key: "amount",
    header: "Monto",
    render: (row) => <MoneyText value={row.amount} />,
    className: "px-3 py-2 text-right",
  },
  { key: "payment", header: "Pago", render: (row) => row.payment },
  { key: "note", header: "Nota", render: (row) => row.note },
];

export function PurchasesPage() {
  const closingStatus = useAppStore((state) => state.closingStatus);
  const isClosed = closingStatus === "closed";

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">Registro mensual</p>
        </div>
        <Button disabled={isClosed}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva compra
        </Button>
      </div>
      <Card className="flex min-h-0 flex-1 flex-col p-3">
        <DataTable
          columns={columns}
          emptyText="Sin compras registradas"
          rows={[]}
        />
        <div className="mt-auto flex items-center justify-end border-t border-border pt-3">
          <span className="mr-3 text-sm text-muted-foreground">Total compras</span>
          <MoneyText className="text-lg font-semibold" value={0} />
        </div>
      </Card>
    </section>
  );
}

