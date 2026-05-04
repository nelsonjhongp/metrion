import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { purchaseFormSchema } from "../../shared/purchase-validation";
import type { Purchase, PurchaseFormValues } from "../../shared/types";
import { Button } from "./ui/button";

type PurchaseDialogProps = {
  defaultDate: string;
  open: boolean;
  purchase?: Purchase | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PurchaseFormValues) => Promise<void>;
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
  purchase,
  onOpenChange,
  onSubmit,
}: PurchaseDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
  } = useForm<PurchaseFormValues>({
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (open) {
      reset(initialValues);
      setFormError(null);
    }
  }, [initialValues, open, reset]);

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
      await onSubmit(parsed.data);
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/35" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-5 shadow-soft">
          <Dialog.Title className="text-base font-semibold text-foreground">
            {purchase ? "Editar compra" : "Nueva compra"}
          </Dialog.Title>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit(submit)}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha" error={errors.purchaseDate?.message}>
                <input
                  className="field"
                  type="date"
                  {...register("purchaseDate")}
                />
              </Field>
              <Field label="RUC" error={errors.ruc?.message}>
                <input className="field" maxLength={11} {...register("ruc")} />
              </Field>
            </div>
            <Field label="Proveedor" error={errors.supplierName?.message}>
              <input className="field" {...register("supplierName")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Factura" error={errors.invoiceNumber?.message}>
                <input className="field" {...register("invoiceNumber")} />
              </Field>
              <Field label="Monto" error={errors.amount?.message}>
                <input
                  className="field text-right"
                  inputMode="decimal"
                  {...register("amount")}
                />
              </Field>
            </div>
            <Field label="Pago" error={errors.payment?.message}>
              <input className="field" {...register("payment")} />
            </Field>
            <Field label="Nota" error={errors.note?.message}>
              <textarea
                className="field h-20 resize-none py-2"
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
