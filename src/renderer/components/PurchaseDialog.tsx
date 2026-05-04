import * as Dialog from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { purchaseFormSchema } from "../../shared/purchase-validation";
import type { Purchase, PurchaseFormValues, Supplier } from "../../shared/types";
import { Button } from "./ui/button";
import { SupplierDialog } from "./SupplierDialog";
import { useAppStore } from "../stores/app-store";

type PurchaseDialogProps = {
  defaultDate: string;
  open: boolean;
  profileId: number | null;
  purchase?: Purchase | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PurchaseFormValues, supplierId?: number | null) => Promise<void>;
};

const emptyValues = (defaultDate: string): PurchaseFormValues => ({
  purchaseDate: defaultDate,
  ruc: "",
  supplierName: "",
  invoiceNumber: "",
  amount: "",
  payment: "",
  note: "",
});

const purchaseValues = (purchase: Purchase): PurchaseFormValues => ({
  purchaseDate: purchase.purchaseDate,
  ruc: purchase.ruc ?? "",
  supplierName: purchase.supplierName,
  invoiceNumber: purchase.invoiceNumber ?? "",
  amount: String(purchase.amount),
  payment: purchase.payment ?? "",
  note: purchase.note ?? "",
});

export function PurchaseDialog({
  defaultDate,
  open,
  profileId,
  purchase,
  onOpenChange,
  onSubmit,
}: PurchaseDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastLookupRuc, setLastLookupRuc] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [showNewSupplierHint, setShowNewSupplierHint] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const preselectedRef = useRef(false);

  const initialValues = useMemo(
    () => (purchase ? purchaseValues(purchase) : emptyValues(defaultDate)),
    [defaultDate, purchase],
  );

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<PurchaseFormValues>({
    defaultValues: initialValues,
  });

  const watchedSupplierName = watch("supplierName");

  const rucField = register("ruc", {
    onBlur: (event) => {
      void lookupSupplierByRuc(event.target.value);
    },
    onChange: (event) => {
      const value = event.target.value;
      if (/^\d{11}$/.test(value)) {
        void lookupSupplierByRuc(value);
      }
    },
  });

  // Load suppliers on mount
  useEffect(() => {
    if (profileId) {
      window.metrion.listSuppliers({ profileId }).then(setSuppliers).catch(() => {});
    } else {
      setSuppliers([]);
    }
  }, [profileId]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      reset(initialValues);
      setFormError(null);
      setLastLookupRuc(null);
      setShowNewSupplierHint(false);
      setSelectedSupplierId(purchase?.supplierId ?? null);
      preselectedRef.current = false;
    }
  }, [initialValues, open, reset]);

  // Detect if typed supplier name is new
  useEffect(() => {
    if (!watchedSupplierName || watchedSupplierName.trim().length === 0) {
      setShowNewSupplierHint(false);
      return;
    }
    const name = watchedSupplierName.trim().toLowerCase();
    const exists = suppliers.some(
      (s) => s.name.toLowerCase() === name,
    );
    setShowNewSupplierHint(!exists);
    if (!exists) {
      setSelectedSupplierId(null);
    }
  }, [watchedSupplierName, suppliers]);

  async function lookupSupplierByRuc(rawRuc: string) {
    const ruc = rawRuc.trim();
    if (!profileId || ruc.length === 0 || ruc === lastLookupRuc) return;
    setLastLookupRuc(ruc);

    try {
      const supplier = await window.metrion.findSupplierByRuc({ profileId, ruc });
      if (supplier) {
        setValue("supplierName", supplier.name, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } catch {
      // silent
    }
  }

  function handleSupplierSelect(supplierId: string) {
    if (!supplierId) {
      setSelectedSupplierId(null);
      return;
    }
    const supplier = suppliers.find((s) => String(s.id) === supplierId);
    if (supplier) {
      preselectedRef.current = true;
      setSelectedSupplierId(supplier.id);
      setValue("supplierName", supplier.name, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (/\d/.test(supplier.ruc)) {
        setValue("ruc", supplier.ruc, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setShowNewSupplierHint(false);
    }
  }

  async function handleQuickCreateSupplier(values: { ruc: string; name: string; note: string }) {
    if (!profileId) return;
    try {
      const created = await window.metrion.createSupplier({
        profileId,
        ruc: values.ruc.trim(),
        name: values.name.trim(),
        note: values.note.trim() || null,
      });
      // Refresh supplier list
      const updated = await window.metrion.listSuppliers({ profileId });
      setSuppliers(updated);

      // Populate form
      preselectedRef.current = true;
      setSelectedSupplierId(created.id);
      setValue("supplierName", created.name, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (/\d/.test(created.ruc)) {
        setValue("ruc", created.ruc, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setSupplierDialogOpen(false);
    } catch (err) {
      throw err;
    }
  }

  async function submit(values: PurchaseFormValues) {
    const parsed = purchaseFormSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          setError(field as keyof PurchaseFormValues, {
            message: issue.message,
          });
        }
      }
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await onSubmit(parsed.data, selectedSupplierId);
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-5 shadow-soft">
            <Dialog.Title className="text-base font-semibold text-foreground">
              {purchase ? "Editar compra" : "Nueva compra"}
            </Dialog.Title>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit(submit)}>
              {/* Row 1: Date + Invoice */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha" error={errors.purchaseDate?.message}>
                  <input className="field" type="date" {...register("purchaseDate")} />
                </Field>
                <Field label="Factura" error={errors.invoiceNumber?.message}>
                  <input
                    className="field"
                    placeholder="Nro de factura"
                    {...register("invoiceNumber")}
                  />
                </Field>
              </div>

              {/* Supplier section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Proveedor</span>
                  {suppliers.length > 0 && (
                    <select
                      className="h-7 max-w-[220px] rounded border border-border bg-white px-2 text-xs text-muted-foreground outline-none"
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                      value=""
                    >
                      <option value="">Seleccionar existente...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}{s.ruc ? ` (${s.ruc})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  className="field"
                  placeholder="Nombre del proveedor"
                  {...register("supplierName")}
                />
                {errors.supplierName?.message && (
                  <p className="text-xs text-red-600">{errors.supplierName.message}</p>
                )}
                {showNewSupplierHint && (
                  <button
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={() => setSupplierDialogOpen(true)}
                    type="button"
                  >
                    <Plus className="h-3 w-3" />
                    Crear proveedor &quot;{watchedSupplierName.trim()}&quot;
                  </button>
                )}
              </div>

              {/* Row 2: RUC + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="RUC (opcional)" error={errors.ruc?.message}>
                  <input
                    className="field"
                    maxLength={11}
                    placeholder="11 digitos"
                    {...rucField}
                  />
                </Field>
                <Field label="Monto" error={errors.amount?.message}>
                  <input
                    className="field text-right"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register("amount")}
                  />
                </Field>
              </div>

              {/* Row 3: Payment */}
              <Field label="Pago" error={errors.payment?.message}>
                <input
                  className="field"
                  placeholder="Ej: BCP, BANCARIZAR, efectivo"
                  {...register("payment")}
                />
              </Field>

              {/* Row 4: Note */}
              <Field label="Nota" error={errors.note?.message}>
                <textarea
                  className="field h-16 resize-none py-2"
                  placeholder="Opcional"
                  {...register("note")}
                />
              </Field>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button disabled={isSaving} type="submit">
                  Guardar
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Quick-create supplier dialog */}
      <SupplierDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onSubmit={handleQuickCreateSupplier}
      />
    </>
  );
}

type FieldProps = {
  children: ReactNode;
  error?: string;
  label: string;
};

function Field({ children, error, label }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}
