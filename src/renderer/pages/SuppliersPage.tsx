import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { DataTable, type DataTableColumn } from "../components/DataTable";

type SupplierRow = {
  ruc: string;
  name: string;
  note: string;
};

const columns: DataTableColumn<SupplierRow>[] = [
  { key: "ruc", header: "RUC", render: (row) => row.ruc },
  { key: "name", header: "Nombre", render: (row) => row.name },
  { key: "note", header: "Nota", render: (row) => row.note },
];

export function SuppliersPage() {
  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Proveedores</h1>
        <Button>Nuevo proveedor</Button>
      </div>
      <Card className="p-3">
        <DataTable
          columns={columns}
          emptyText="Sin proveedores registrados"
          rows={[]}
        />
      </Card>
    </section>
  );
}

