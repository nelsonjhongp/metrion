import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { SupplierDialog } from "../components/SupplierDialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppStore } from "../stores/app-store";
import type { Supplier, SupplierFormValues } from "../../shared/types";

function normalizeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_]+$/, "")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface DupeGroup {
  canonical: string;
  names: string[];
}

function findDuplicateGroups(suppliers: Supplier[]): DupeGroup[] {
  const groups = new Map<string, string[]>();

  for (const s of suppliers) {
    const key = normalizeKey(s.name);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.push(s.name);
    } else {
      groups.set(key, [s.name]);
    }
  }

  const result: DupeGroup[] = [];
  for (const [, names] of groups) {
    if (names.length > 1) {
      const unique = [...new Set(names)];
      if (unique.length > 1) {
        result.push({ canonical: unique[0]!, names: unique });
      }
    }
  }

  return result;
}

export function SuppliersPage() {
  const profileId = useAppStore((state) => state.profileId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  async function loadSuppliers() {
    if (!profileId) {
      setSuppliers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rows = await window.metrion.listSuppliers({ profileId });
      setSuppliers(rows);
    } catch {
      setError("No se pudieron cargar los proveedores.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, [profileId]);

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
      ruc: values.ruc.trim(),
      name: values.name.trim(),
      note: emptyToNull(values.note),
    };

    if (editingSupplier) {
      await window.metrion.updateSupplier({
        ...input,
        id: editingSupplier.id,
      });
    } else {
      await window.metrion.createSupplier(input);
    }

    await loadSuppliers();
  }

  async function deleteSupplier(id: number) {
    try {
      await window.metrion.deleteSupplier(id);
      await loadSuppliers();
    } catch {
      setError("No se pudo eliminar el proveedor.");
    }
  }

  const columns: DataTableColumn<Supplier>[] = [
    { key: "ruc", header: "RUC", render: (row) => row.ruc },
    { key: "name", header: "Nombre", render: (row) => row.name },
    { key: "note", header: "Nota", render: (row) => row.note ?? "" },
    {
      key: "actions",
      header: "",
      className: "px-3 py-2 text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button onClick={() => openEditSupplier(row)} size="sm" variant="ghost">
            <Pencil className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            confirmLabel="Eliminar"
            description="El proveedor se eliminara del catalogo."
            onConfirm={() => void deleteSupplier(row.id)}
            title="Eliminar proveedor"
          >
            <Button size="sm" variant="ghost">
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConfirmDialog>
        </div>
      ),
    },
  ];

  const dupeGroups = useMemo(() => findDuplicateGroups(suppliers), [suppliers]);

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Proveedores</h1>
        <Button disabled={!profileId} onClick={openNewSupplier}>
          Nuevo proveedor
        </Button>
      </div>

      {dupeGroups.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Posibles proveedores duplicados
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {dupeGroups.map((group, i) => (
              <li className="text-xs text-amber-700" key={i}>
                {group.names.join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col p-3">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            Cargando proveedores...
          </div>
        ) : (
          <DataTable
            columns={columns}
            emptyText="Sin proveedores registrados"
            rows={suppliers}
          />
        )}
      </Card>
      <SupplierDialog
        onOpenChange={setDialogOpen}
        onSubmit={saveSupplier}
        open={dialogOpen}
        supplier={editingSupplier}
      />
    </section>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

