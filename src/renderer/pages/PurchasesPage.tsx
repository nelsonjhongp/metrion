import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { MoneyText } from "../components/MoneyText";
import { PageHeader } from "../components/PageHeader";
import { PurchaseDialog } from "../components/PurchaseDialog";
import { TablePaginationControls } from "../components/TablePaginationControls";
import { TableToolbar, TableToolbarField } from "../components/TableToolbar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";
import type { Purchase, PurchaseFormValues } from "../../shared/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type PurchasesPageProps = {
  onOpenSupplierCatalogFromPurchase: () => void;
};

export function PurchasesPage({ onOpenSupplierCatalogFromPurchase }: PurchasesPageProps) {
  const {
    businessUnitId,
    closingStatus,
    month,
    purchaseSupplierFlow,
    profileId,
    clearPurchaseSupplierFlow,
    acknowledgePurchaseSupplierFlowResume,
    startPurchaseSupplierFlow,
    year,
  } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  useEffect(() => {
    if (
      purchaseSupplierFlow?.resumeRequested &&
      purchaseSupplierFlow.returnPage === "purchases"
    ) {
      setEditingPurchase(purchaseSupplierFlow.purchase);
      setDialogOpen(true);
      acknowledgePurchaseSupplierFlowResume();
    }
  }, [acknowledgePurchaseSupplierFlowResume, purchaseSupplierFlow]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search]);

  function openNewPurchase() {
    setEditingPurchase(null);
    setDialogOpen(true);
  }

  function openEditPurchase(purchase: Purchase) {
    setEditingPurchase(purchase);
    setDialogOpen(true);
  }

  async function savePurchase(values: PurchaseFormValues, supplierId?: number | null) {
    if (!profileId || !businessUnitId) {
      throw new Error("Selecciona perfil y unidad.");
    }

    const input = {
      profileId,
      businessUnitId,
      month,
      year,
      supplierId: supplierId ?? null,
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

    clearPurchaseSupplierFlow();
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
            aria-label="Editar compra"
            disabled={isClosed}
            onClick={() => openEditPurchase(row)}
            size="sm"
            variant="ghost"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            confirmLabel="Eliminar"
            description="Esta compra se eliminara del mes."
            onConfirm={() => void deletePurchase(row.id)}
            title="Eliminar compra"
          >
            <Button aria-label="Eliminar compra" disabled={isClosed} size="sm" variant="ghost">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          </ConfirmDialog>
        </div>
      ),
    },
  ];

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return purchases;

    return purchases.filter((purchase) =>
      [
        purchase.purchaseDate,
        purchase.ruc ?? "",
        purchase.supplierName,
        purchase.invoiceNumber ?? "",
        purchase.payment ?? "",
        purchase.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [purchases, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedPurchases = filteredPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="flex h-full flex-col gap-4">
      <PageHeader
        actions={(
          <Button
          disabled={isClosed || !profileId || !businessUnitId}
          onClick={openNewPurchase}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva compra
          </Button>
        )}
        description="Registro mensual"
        title="Compras"
      />
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableToolbar>
          <TableToolbarField className="min-w-[240px] flex-1" label="Buscar">
            <input
              className="field h-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Proveedor, factura, RUC o pago…"
              value={search}
            />
          </TableToolbarField>
        </TableToolbar>
        <div className="flex min-h-0 flex-1 flex-col p-3">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            Cargando compras…
          </div>
        ) : (
          <DataTable
            columns={columns}
            emptyText="Sin compras para los filtros actuales"
            getRowKey={(row) => row.id}
            rows={pagedPurchases}
          />
        )}
        <div className="mt-auto flex items-center justify-end border-t border-border pt-3">
          <span className="mr-3 text-sm text-muted-foreground">Total compras</span>
          <MoneyText className="text-lg font-semibold" value={totalAmount} />
        </div>
        </div>
        <TablePaginationControls
          itemLabel="compras"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          totalItems={filteredPurchases.length}
        />
      </Card>
      <PurchaseDialog
        defaultDate={getDefaultPurchaseDate(month, year)}
        draftValues={
          purchaseSupplierFlow?.returnPage === "purchases"
            ? purchaseSupplierFlow.values
            : null
        }
        initialSupplierId={
          purchaseSupplierFlow?.returnPage === "purchases"
            ? purchaseSupplierFlow.supplierId
            : null
        }
        onCancel={clearPurchaseSupplierFlow}
        onCreateSupplierInCatalog={(draft) => {
          startPurchaseSupplierFlow({
            ...draft,
            returnPage: "purchases",
          });
          onOpenSupplierCatalogFromPurchase();
        }}
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
