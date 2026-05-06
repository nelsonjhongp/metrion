import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { supplierFormSchema } from "../../shared/supplier-validation";
import type { Supplier, SupplierFormValues } from "../../shared/types";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type SupplierDialogProps = {
  footerHint?: string | null;
  open: boolean;
  supplier?: Supplier | null;
  draftValues?: Partial<SupplierFormValues> | null;
  similarSuppliers?: Supplier[];
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
    ruc: supplier.ruc ?? "",
    name: supplier.name,
    note: supplier.note ?? "",
  };
}

export function SupplierDialog({
  footerHint,
  open,
  supplier,
  draftValues,
  similarSuppliers = [],
  onOpenChange,
  onSubmit,
}: SupplierDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initialValues = useMemo(
    () => {
      if (supplier) {
        return supplierValues(supplier);
      }

      return {
        ...emptyValues,
        ruc: draftValues?.ruc ?? "",
        name: draftValues?.name ?? "",
        note: draftValues?.note ?? "",
      };
    },
    [draftValues?.name, draftValues?.note, draftValues?.ruc, supplier],
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[440px]">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit(submit)}>
            <Field label="RUC (opcional)" error={errors.ruc?.message}>
              <Input maxLength={11} {...register("ruc")} />
            </Field>
            <Field label="Nombre" error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <Field label="Nota" error={errors.note?.message}>
              <Textarea {...register("note")} />
            </Field>
            {similarSuppliers.length > 0 && (
              <Alert variant="warning">
                <p className="font-medium">Posibles coincidencias</p>
                <p className="mt-1 text-xs">
                  Revisa si alguno ya existe antes de crear otro proveedor.
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {similarSuppliers.slice(0, 4).map((candidate) => (
                    <li key={candidate.id}>
                      {candidate.name}
                      {candidate.ruc ? ` (${candidate.ruc})` : ""}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
            {formError && <Alert variant="danger">{formError}</Alert>}
            {footerHint && (
              <p className="text-xs text-muted-foreground">{footerHint}</p>
            )}
            <DialogFooter>
              <Button
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button disabled={isSaving} type="submit">
                Guardar
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
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
      {error && <p className="mt-1 text-xs text-danger-foreground">{error}</p>}
    </label>
  );
}
