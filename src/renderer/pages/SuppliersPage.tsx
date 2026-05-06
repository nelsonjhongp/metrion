import * as Dialog from "@radix-ui/react-dialog";
import { Link2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { SupplierDialog } from "../components/SupplierDialog";
import { TablePaginationControls } from "../components/TablePaginationControls";
import { TableToolbar, TableToolbarField } from "../components/TableToolbar";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";
import type {
  ResolveSupplierDirectoryEntryInput,
  Supplier,
  SupplierDirectoryEntry,
  SupplierFormValues,
  SupplierNormalizationSweepResult,
} from "../../shared/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type StatusFilter = "all" | "cataloged" | "pending";
type RucFilter = "all" | "with" | "without";

function normalizeSupplierExactName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSupplierSimilarityName(value: string): string {
  return normalizeSupplierExactName(value).replace(/[-_]+$/g, "");
}

type SuppliersPageProps = {
  onReturnToPurchaseFlow: () => void;
};

export function SuppliersPage({ onReturnToPurchaseFlow }: SuppliersPageProps) {
  const profileId = useAppStore((state) => state.profileId);
  const purchaseSupplierFlow = useAppStore((state) => state.purchaseSupplierFlow);
  const clearPurchaseSupplierFlow = useAppStore((state) => state.clearPurchaseSupplierFlow);
  const markPurchaseSupplierFlowForResume = useAppStore((state) => state.markPurchaseSupplierFlowForResume);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [resolveEntry, setResolveEntry] = useState<SupplierDirectoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningSweep, setIsRunningSweep] = useState(false);
  const [purchaseFlowDialogInitialized, setPurchaseFlowDialogInitialized] = useState(false);
  const [sweepResult, setSweepResult] = useState<SupplierNormalizationSweepResult | null>(null);
  const [directory, setDirectory] = useState<SupplierDirectoryEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rucFilter, setRucFilter] = useState<RucFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadSuppliers() {
    if (!profileId) {
      setDirectory([]);
      setSuppliers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supplierRows = await window.metrion.listSuppliers({ profileId });
      let directoryRows: SupplierDirectoryEntry[];

      if (typeof window.metrion.listSupplierDirectory === "function") {
        try {
          directoryRows = await window.metrion.listSupplierDirectory({ profileId });
        } catch {
          directoryRows = mapSuppliersToDirectoryEntries(supplierRows);
        }
      } else {
        directoryRows = mapSuppliersToDirectoryEntries(supplierRows);
      }

      setDirectory(directoryRows);
      setSuppliers(supplierRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los proveedores.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, [profileId]);

  useEffect(() => {
    if (!purchaseSupplierFlow) {
      setPurchaseFlowDialogInitialized(false);
      return;
    }

    if (!purchaseFlowDialogInitialized && !dialogOpen && !editingSupplier) {
      setDialogOpen(true);
      setPurchaseFlowDialogInitialized(true);
    }
  }, [dialogOpen, editingSupplier, purchaseFlowDialogInitialized, purchaseSupplierFlow]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, rucFilter, search, statusFilter]);

  function openNewSupplier() {
    setEditingSupplier(null);
    setDialogOpen(true);
  }

  function openEditSupplier(supplier: Supplier) {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  }

  async function saveSupplier(values: SupplierFormValues) {
    if (!profileId) {
      throw new Error("Selecciona un perfil.");
    }

    const input = {
      profileId,
      ruc: emptyToNull(values.ruc),
      name: values.name.trim(),
      note: emptyToNull(values.note),
    };

    let savedSupplier: Supplier;

    if (editingSupplier) {
      savedSupplier = await window.metrion.updateSupplier({
        ...input,
        id: editingSupplier.id,
      });
    } else {
      savedSupplier = await window.metrion.createSupplier(input);
    }

    await loadSuppliers();

    if (!editingSupplier && purchaseSupplierFlow) {
      markPurchaseSupplierFlowForResume(savedSupplier);
      onReturnToPurchaseFlow();
    }
  }

  async function deleteSupplier(id: number) {
    try {
      await window.metrion.deleteSupplier(id);
      await loadSuppliers();
    } catch {
      setError("No se pudo eliminar el proveedor.");
    }
  }

  async function resolveSupplier(input: ResolveSupplierDirectoryEntryInput) {
    await window.metrion.resolveSupplierDirectoryEntry(input);
    await loadSuppliers();
  }

  async function handleRunNormalizationSweep() {
    if (!profileId) {
      return;
    }

    setIsRunningSweep(true);
    setError(null);

    try {
      const result = await window.metrion.runSupplierNormalizationSweep({ profileId });
      setSweepResult(result);
      await loadSuppliers();
    } catch (sweepError) {
      setError(
        sweepError instanceof Error
          ? sweepError.message
          : "No se pudo ejecutar la verificación de proveedores.",
      );
    } finally {
      setIsRunningSweep(false);
    }
  }

  const filteredRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return directory.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }

      if (rucFilter === "with" && !entry.ruc) return false;
      if (rucFilter === "without" && entry.ruc) return false;

      if (!searchValue) return true;

      const haystack = [
        entry.name,
        entry.ruc ?? "",
        entry.aliases.join(" "),
        entry.note ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [directory, rucFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const similarSuppliersForDraft = useMemo(() => {
    const draftName = purchaseSupplierFlow?.values.supplierName ?? "";
    const draftRuc = purchaseSupplierFlow?.values.ruc ?? "";
    const exactName = normalizeSupplierExactName(draftName);
    const similarName = normalizeSupplierSimilarityName(draftName);

    return suppliers.filter((supplier) => {
      if (draftRuc && supplier.ruc === draftRuc) {
        return true;
      }

      const supplierExact = normalizeSupplierExactName(supplier.name);
      const supplierSimilar = normalizeSupplierSimilarityName(supplier.name);
      return supplierExact === exactName || supplierSimilar === similarName;
    });
  }, [purchaseSupplierFlow?.values.ruc, purchaseSupplierFlow?.values.supplierName, suppliers]);

  const columns: DataTableColumn<SupplierDirectoryEntry>[] = [
    {
      key: "name",
      header: "Proveedor",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          {row.aliases.length > 1 ? (
            <p className="truncate text-xs text-muted-foreground">
              Alias: {row.aliases.filter((alias) => alias !== row.name).join(" · ")}
            </p>
          ) : row.note ? (
            <p className="truncate text-xs text-muted-foreground">{row.note}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "ruc",
      header: "RUC",
      render: (row) => row.ruc ?? "—",
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => (
        <Badge variant={row.status === "cataloged" ? "secondary" : "warning"}>
          {row.status === "cataloged" ? "Catalogado" : "Pendiente"}
        </Badge>
      ),
    },
    {
      key: "purchases",
      header: "Compras",
      className: "px-3 py-2 text-right text-sm text-muted-foreground",
      render: (row) => row.purchaseCount,
    },
    {
      key: "lastSeen",
      header: "Última aparición",
      render: (row) => formatDate(row.lastPurchaseDate),
    },
    {
      key: "actions",
      header: "",
      className: "px-3 py-2 text-right",
      render: (row) =>
        row.status === "cataloged" && row.supplierId ? (
          <div className="flex justify-end gap-1">
            <Button aria-label="Editar proveedor" onClick={() => {
              const supplier = suppliers.find((item) => item.id === row.supplierId);
              if (supplier) {
                openEditSupplier(supplier);
              }
            }} size="sm" variant="ghost">
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              confirmLabel="Eliminar"
              description="El proveedor se eliminara del catalogo."
              onConfirm={() => void deleteSupplier(row.supplierId!)}
              title="Eliminar proveedor"
            >
              <Button aria-label="Eliminar proveedor" size="sm" variant="ghost">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </ConfirmDialog>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button onClick={() => setResolveEntry(row)} size="sm" variant="secondary">
              <Link2 className="mr-1.5 h-4 w-4" />
              Normalizar
            </Button>
          </div>
        ),
    },
  ];

  return (
    <section className="flex h-full flex-col gap-4">
      <PageHeader
        actions={(
          <div className="flex items-center gap-2">
            {purchaseSupplierFlow && (
              <Button
                onClick={() => {
                  markPurchaseSupplierFlowForResume(null);
                  onReturnToPurchaseFlow();
                }}
                variant="secondary"
              >
                Volver a compra
              </Button>
            )}
            <Button
              disabled={!profileId || isRunningSweep}
              onClick={() => void handleRunNormalizationSweep()}
              variant="secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Verificar proveedores
            </Button>
            <Button disabled={!profileId} onClick={openNewSupplier}>
              Nuevo proveedor
            </Button>
          </div>
        )}
        description="Catálogo normalizado desde compras"
        title="Proveedores"
      />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableToolbar>
          <TableToolbarField className="min-w-[220px] flex-1" label="Buscar">
            <input
              className="field h-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, RUC o alias…"
              value={search}
            />
          </TableToolbarField>
          <TableToolbarField className="min-w-[160px]" label="Estado">
            <select
              className="select-field h-9 px-3 text-sm"
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">Todos</option>
              <option value="cataloged">Catalogados</option>
              <option value="pending">Pendientes</option>
            </select>
          </TableToolbarField>
          <TableToolbarField className="min-w-[140px]" label="RUC">
            <select
              className="select-field h-9 px-3 text-sm"
              onChange={(event) => setRucFilter(event.target.value as RucFilter)}
              value={rucFilter}
            >
              <option value="all">Todos</option>
              <option value="with">Con RUC</option>
              <option value="without">Sin RUC</option>
            </select>
          </TableToolbarField>
        </TableToolbar>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          {purchaseSupplierFlow && (
            <Alert className="mb-3" variant="info">
              <p className="font-medium">Creando proveedor desde una compra</p>
              <p className="mt-1 text-xs">
                Al guardar o volver, retomaremos la compra con sus datos intactos.
              </p>
            </Alert>
          )}
          {sweepResult && (
            <Alert className="mb-3" variant="success">
              <p className="font-medium">Verificación completada</p>
              <p className="mt-1 text-xs">
                {sweepResult.linkedPurchases} compras vinculadas, {sweepResult.mergedCatalogSuppliers} proveedores fusionados y {sweepResult.pendingEntries} pendientes por revisar.
              </p>
              {sweepResult.similarGroups.length > 0 && (
                <p className="mt-1 text-xs">
                  Quedaron {sweepResult.similarGroups.length} grupos parecidos para revisión manual.
                </p>
              )}
            </Alert>
          )}
          {error && <Alert className="mb-3" variant="danger">{error}</Alert>}
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              Cargando proveedores…
            </div>
          ) : (
            <DataTable
              columns={columns}
              emptyText="Sin proveedores para los filtros actuales"
              getRowKey={(row) => row.entryKey}
              rows={pagedRows}
            />
          )}
        </div>

        <TablePaginationControls
          itemLabel="proveedores"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          totalItems={filteredRows.length}
        />
      </Card>

      <SupplierDialog
        draftValues={purchaseSupplierFlow?.values ?? null}
        footerHint={
          purchaseSupplierFlow
            ? "Al guardar volverás a la compra con el proveedor ya vinculado."
            : null
        }
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen && purchaseSupplierFlow) {
            markPurchaseSupplierFlowForResume(null);
            onReturnToPurchaseFlow();
          }
        }}
        onSubmit={saveSupplier}
        open={dialogOpen}
        similarSuppliers={similarSuppliersForDraft}
        supplier={editingSupplier}
      />

      <ResolveSupplierDialog
        entry={resolveEntry}
        onOpenChange={(open) => {
          if (!open) {
            setResolveEntry(null);
          }
        }}
        onSubmit={async (input) => {
          if (!profileId) return;
          await resolveSupplier({ profileId, entryKey: resolveEntry!.entryKey, ...input });
          setResolveEntry(null);
        }}
        suppliers={suppliers}
      />
    </section>
  );
}

function mapSuppliersToDirectoryEntries(suppliers: Supplier[]): SupplierDirectoryEntry[] {
  return suppliers.map<SupplierDirectoryEntry>((supplier) => ({
    entryKey: `cataloged:${supplier.id}`,
    status: "cataloged",
    supplierId: supplier.id,
    ruc: supplier.ruc,
    name: supplier.name,
    note: supplier.note,
    purchaseCount: 0,
    lastPurchaseDate: null,
    aliases: [supplier.name],
  }));
}

type ResolveSupplierDialogProps = {
  entry: SupplierDirectoryEntry | null;
  suppliers: Supplier[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: Omit<ResolveSupplierDirectoryEntryInput, "profileId" | "entryKey">) => Promise<void>;
};

function ResolveSupplierDialog({
  entry,
  suppliers,
  onOpenChange,
  onSubmit,
}: ResolveSupplierDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [targetSupplierId, setTargetSupplierId] = useState("");
  const [name, setName] = useState("");
  const [ruc, setRuc] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setMode("new");
    setTargetSupplierId("");
    setName(entry.name);
    setRuc(entry.ruc ?? "");
    setNote("");
    setError(null);
  }, [entry]);

  async function handleSubmit() {
    if (!entry) return;

    setIsSaving(true);
    setError(null);

    try {
      if (mode === "existing") {
        if (!targetSupplierId) {
          throw new Error("Selecciona un proveedor del catálogo.");
        }
        await onSubmit({ targetSupplierId: Number(targetSupplierId) });
      } else {
        if (!name.trim()) {
          throw new Error("Nombre requerido.");
        }
        await onSubmit({
          supplier: {
            name: name.trim(),
            ruc: emptyToNull(ruc),
            note: emptyToNull(note),
          },
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo normalizar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={Boolean(entry)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/35" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-5 shadow-soft">
          <Dialog.Title className="text-base font-semibold text-foreground">
            Normalizar proveedor
          </Dialog.Title>
          {entry ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-[#fafbfc] p-3">
                <p className="text-sm font-medium text-foreground">{entry.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.purchaseCount} compras · {formatDate(entry.lastPurchaseDate)}
                </p>
                {entry.aliases.length > 1 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Alias detectados: {entry.aliases.join(" · ")}
                  </p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setMode("new")}
                  size="sm"
                  type="button"
                  variant={mode === "new" ? "primary" : "secondary"}
                >
                  Crear proveedor
                </Button>
                <Button
                  onClick={() => setMode("existing")}
                  size="sm"
                  type="button"
                  variant={mode === "existing" ? "primary" : "secondary"}
                >
                  Vincular existente
                </Button>
              </div>

              {mode === "existing" ? (
                <label className="block">
                  <span className="text-sm font-medium">Proveedor del catálogo</span>
                  <select
                    className="select-field mt-1 h-9 w-full px-3 text-sm"
                    onChange={(event) => setTargetSupplierId(event.target.value)}
                    value={targetSupplierId}
                  >
                    <option value="">Seleccionar…</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}{supplier.ruc ? ` (${supplier.ruc})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium">Nombre</span>
                    <input className="field mt-1" onChange={(event) => setName(event.target.value)} value={name} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">RUC (opcional)</span>
                    <input className="field mt-1" maxLength={11} onChange={(event) => setRuc(event.target.value)} value={ruc} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Nota</span>
                    <textarea className="field mt-1 h-20 resize-none py-2" onChange={(event) => setNote(event.target.value)} value={note} />
                  </label>
                </div>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button disabled={isSaving} onClick={() => onOpenChange(false)} variant="secondary">
                  Cancelar
                </Button>
                <Button disabled={isSaving} onClick={() => void handleSubmit()}>
                  {isSaving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDate(value: string | null): string {
  if (!value) return "Sin compras";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
