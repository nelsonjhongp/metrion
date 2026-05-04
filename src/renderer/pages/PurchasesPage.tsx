import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { MoneyText } from "../components/MoneyText";
import { PurchaseDialog } from "../components/PurchaseDialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";
import type { Purchase, PurchaseFormValues } from "../../shared/types";

export function PurchasesPage() {
  const {
    businessUnitId,
    closingStatus,
    month,
    profileId,
    year,
  } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const isClosed = closingStatus === "closed";

  async function loadPurchases() {
    if (!profileId || !businessUnitId) {
      setPurchases([]);
      setTotalAmount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.metrion.listPurchases({
        profileId,
        businessUnitId,
        month,
        year,
      });
      setPurchases(response.rows);
      setTotalAmount(response.totalAmount);
    } catch {
      setError("No se pudieron cargar las compras.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPurchases();
  }, [businessUnitId, month, profileId, year]);

  function openNewPurchase() {
    setEditingPurchase(null);
    setDialogOpen(true);
  }

  function openEditPurchase(purchase: Purchase) {
    setEditingPurchase(purchase);
    setDialogOpen(true);
  }

  async function savePurchase(values: PurchaseFormValues) {
    if (!profileId || !businessUnitId) {
      throw new Error("Selecciona perfil y unidad.");
    }

    const input = {
      profileId,
      businessUnitId,
      month,
      year,
      purchaseDate: values.purchaseDate,
      ruc: emptyToNull(values.ruc),
      supplierName: values.supplierName.trim(),
      invoiceNumber: emptyToNull(values.invoiceNumber),
      amount: Number(values.amount.replace(",", ".")),
      payment: emptyToNull(values.payment),
      note: emptyToNull(values.note),
    };

    if (editingPurchase) {
      await window.metrion.updatePurchase({
        ...input,
        id: editingPurchase.id,
      });
    } else {
      await window.metrion.createPurchase(input);
    }

    await loadPurchases();
  }

  async function deletePurchase(id: number) {
    try {
      await window.metrion.deletePurchase(id);
      await loadPurchases();
    } catch {
      setError("No se pudo eliminar la compra.");
    }
  }

  const columns: DataTableColumn<Purchase>[] = [
    {
      key: "date",
      header: "Fecha",
      render: (row) => row.purchaseDate,
    },
    {
      key: "ruc",
      header: "RUC",
      render: (row) => row.ruc ?? "",
    },
    {
      key: "supplier",
      header: "Proveedor",
      render: (row) => row.supplierName,
    },
    {
      key: "invoice",
      header: "Factura",
      render: (row) => row.invoiceNumber ?? "",
    },
    {
      key: "amount",
      header: "Monto",
      render: (row) => <MoneyText value={row.amount} />,
      className: "px-3 py-2 text-right",
    },
    {
      key: "payment",
      header: "Pago",
      render: (row) => row.payment ?? "",
    },
    {
      key: "note",
      header: "Nota",
      render: (row) => row.note ?? "",
    },
    {
      key: "actions",
      header: "",
      className: "px-3 py-2 text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            disabled={isClosed}
            onClick={() => openEditPurchase(row)}
            size="sm"
            variant="ghost"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            confirmLabel="Eliminar"
            description="Esta compra se eliminara del mes."
            onConfirm={() => void deletePurchase(row.id)}
            title="Eliminar compra"
          >
            <Button disabled={isClosed} size="sm" variant="ghost">
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConfirmDialog>
        </div>
      ),
    },
  ];

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">Registro mensual</p>
        </div>
        <Button
          disabled={isClosed || !profileId || !businessUnitId}
          onClick={openNewPurchase}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva compra
        </Button>
      </div>
      <Card className="flex min-h-0 flex-1 flex-col p-3">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            Cargando compras...
          </div>
        ) : (
          <DataTable
            columns={columns}
            emptyText="Sin compras registradas"
            rows={purchases}
          />
        )}
        <div className="mt-auto flex items-center justify-end border-t border-border pt-3">
          <span className="mr-3 text-sm text-muted-foreground">Total compras</span>
          <MoneyText className="text-lg font-semibold" value={totalAmount} />
        </div>
      </Card>
      <PurchaseDialog
        defaultDate={getDefaultPurchaseDate(month, year)}
        onOpenChange={setDialogOpen}
        onSubmit={savePurchase}
        open={dialogOpen}
        profileId={profileId}
        purchase={editingPurchase}
      />
    </section>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getDefaultPurchaseDate(month: number, year: number): string {
  const today = new Date();

  if (today.getMonth() + 1 === month && today.getFullYear() === year) {
    return format(today, "yyyy-MM-dd");
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}
