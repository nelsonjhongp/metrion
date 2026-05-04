import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { supplierFormSchema } from "../../shared/supplier-validation";
import type { Supplier, SupplierFormValues } from "../../shared/types";
import { Button } from "./ui/button";

type SupplierDialogProps = {
  open: boolean;
  supplier?: Supplier | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
};

const emptyValues: SupplierFormValues = {
  ruc: "",
  name: "",
  note: "",
};

function supplierValues(supplier: Supplier): SupplierFormValues {
  return {
    ruc: supplier.ruc,
    name: supplier.name,
    note: supplier.note ?? "",
  };
}

export function SupplierDialog({
  open,
  supplier,
  onOpenChange,
  onSubmit,
}: SupplierDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initialValues = useMemo(
    () => (supplier ? supplierValues(supplier) : emptyValues),
    [supplier],
  );
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<SupplierFormValues>({
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (open) {
      reset(initialValues);
      setFormError(null);
    }
  }, [initialValues, open, reset]);

  async function submit(values: SupplierFormValues) {
    const parsed = supplierFormSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          setError(field as keyof SupplierFormValues, {
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-5 shadow-soft">
          <Dialog.Title className="text-base font-semibold text-foreground">
            {supplier ? "Editar proveedor" : "Nuevo proveedor"}
          </Dialog.Title>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit(submit)}>
            <Field label="RUC" error={errors.ruc?.message}>
              <input className="field" maxLength={11} {...register("ruc")} />
            </Field>
            <Field label="Nombre" error={errors.name?.message}>
              <input className="field" {...register("name")} />
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

