import { Link2, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { purchaseFormSchema } from "../../shared/purchase-validation";
import type {
  Purchase,
  PurchaseFormValues,
  Supplier,
  SupplierDirectoryEntry,
} from "../../shared/types";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

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

type PurchaseDialogProps = {
  defaultDate: string;
  draftValues?: PurchaseFormValues | null;
  initialSupplierId?: number | null;
  open: boolean;
  profileId: number | null;
  purchase?: Purchase | null;
  onCancel: () => void;
  onCreateSupplierInCatalog: (draft: {
    mode: "create" | "edit";
    purchase: Purchase | null;
    supplierId: number | null;
    values: PurchaseFormValues;
  }) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PurchaseFormValues, supplierId?: number | null) => Promise<void>;
};

type SupplierSuggestion = {
  aliases: string[];
  key: string;
  matchLabel: string;
  name: string;
  ruc: string | null;
  similarity: "exact" | "contains" | "similar";
  status: "cataloged" | "pending";
  supplierId: number | null;
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
  draftValues,
  initialSupplierId = null,
  open,
  profileId,
  purchase,
  onCancel,
  onCreateSupplierInCatalog,
  onOpenChange,
  onSubmit,
}: PurchaseDialogProps) {
  const [directoryEntries, setDirectoryEntries] = useState<SupplierDirectoryEntry[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastLookupRuc, setLastLookupRuc] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const supplierFieldRef = useRef<HTMLDivElement | null>(null);
  const closeSuggestionsTimerRef = useRef<number | null>(null);
  const isNavigatingToSupplierCatalogRef = useRef(false);

  const initialValues = useMemo(() => {
    if (draftValues) {
      return draftValues;
    }

    return purchase ? purchaseValues(purchase) : emptyValues(defaultDate);
  }, [defaultDate, draftValues, purchase]);

  const {
    formState: { errors },
    getValues,
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
  const watchedRuc = watch("ruc");
  const watchedInvoiceNumber = watch("invoiceNumber");
  const watchedAmount = watch("amount");
  const watchedPayment = watch("payment");
  const watchedNote = watch("note");
  const watchedPurchaseDate = watch("purchaseDate");
  const rucField = register("ruc", {
    onBlur: (event) => {
      void lookupSupplierByRuc(event.target.value);
    },
  });

  const matchedSupplierByRuc = useMemo(() => {
    const currentRuc = watchedRuc.trim();
    if (!currentRuc) {
      return null;
    }

    return suppliers.find((supplier) => supplier.ruc === currentRuc) ?? null;
  }, [suppliers, watchedRuc]);

  const matchedSupplierByExactName = useMemo(() => {
    const normalizedCurrentName = normalizeSupplierExactName(watchedSupplierName);
    if (!normalizedCurrentName) {
      return null;
    }

    return suppliers.find(
      (supplier) => normalizeSupplierExactName(supplier.name) === normalizedCurrentName,
    ) ?? null;
  }, [suppliers, watchedSupplierName]);

  const suggestions = useMemo(() => {
    const supplierQuery = watchedSupplierName.trim();
    const rucQuery = watchedRuc.trim();
    const exactName = normalizeSupplierExactName(supplierQuery);
    const similarName = normalizeSupplierSimilarityName(supplierQuery);

    if (!supplierQuery && !rucQuery) {
      return [] as SupplierSuggestion[];
    }

    const results: SupplierSuggestion[] = [];

    for (const entry of directoryEntries) {
      const entryExact = normalizeSupplierExactName(entry.name);
      const entrySimilar = normalizeSupplierSimilarityName(entry.name);
      const aliasExactMatches = entry.aliases.some(
        (alias) => normalizeSupplierExactName(alias) === exactName,
      );
      const aliasContainsMatches = entry.aliases.some((alias) =>
        normalizeSupplierExactName(alias).includes(exactName),
      );
      const byRuc = Boolean(rucQuery && entry.ruc?.includes(rucQuery));
      const exact = Boolean(
        supplierQuery && (entryExact === exactName || aliasExactMatches),
      );
      const contains = Boolean(
        supplierQuery && !exact && (
          entryExact.includes(exactName) ||
          aliasContainsMatches
        ),
      );
      const similar = Boolean(
        supplierQuery && !exact && !contains && similarName.length > 0 && entrySimilar === similarName,
      );

      if (!byRuc && !exact && !contains && !similar) {
        continue;
      }

      const matchLabel = byRuc
        ? "Coincidencia por RUC"
        : exact
          ? "Coincidencia exacta"
          : contains
            ? "Coincidencia por nombre"
            : "Nombre parecido";

      results.push({
        aliases: entry.aliases,
        key: entry.entryKey,
        matchLabel,
        name: entry.name,
        ruc: entry.ruc,
        similarity: exact ? "exact" : contains ? "contains" : "similar",
        status: entry.status,
        supplierId: entry.supplierId,
      });
    }

    return results
      .sort((left, right) => {
        const score = (suggestion: SupplierSuggestion) => {
          if (suggestion.similarity === "exact" && suggestion.status === "cataloged") return 0;
          if (suggestion.similarity === "exact") return 1;
          if (suggestion.similarity === "contains" && suggestion.status === "cataloged") return 2;
          if (suggestion.similarity === "contains") return 3;
          if (suggestion.status === "cataloged") return 4;
          return 5;
        };

        return score(left) - score(right) || left.name.localeCompare(right.name, "es");
      })
      .slice(0, 6);
  }, [directoryEntries, watchedRuc, watchedSupplierName]);

  useEffect(() => {
    if (profileId) {
      void window.metrion.listSuppliers({ profileId }).then(setSuppliers).catch(() => {
        setSuppliers([]);
      });
      void window.metrion.listSupplierDirectory({ profileId }).then(setDirectoryEntries).catch(() => {
        setDirectoryEntries([]);
      });
    } else {
      setSuppliers([]);
      setDirectoryEntries([]);
    }
  }, [profileId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(initialValues);
    setFormError(null);
    setLastLookupRuc(null);
    setSelectedSupplierId(initialSupplierId ?? purchase?.supplierId ?? null);
    setShowSuggestions(false);
  }, [initialSupplierId, initialValues, open, purchase, reset]);

  useEffect(() => {
    if (!watchedSupplierName.trim()) {
      if (!matchedSupplierByRuc) {
        setSelectedSupplierId(null);
      }
      return;
    }

    if (matchedSupplierByRuc) {
      setSelectedSupplierId(matchedSupplierByRuc.id);
      return;
    }

    if (matchedSupplierByExactName) {
      setSelectedSupplierId(matchedSupplierByExactName.id);
      return;
    }

    setSelectedSupplierId(null);
  }, [matchedSupplierByExactName, matchedSupplierByRuc, watchedSupplierName]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!supplierFieldRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function lookupSupplierByRuc(rawRuc: string) {
    const ruc = rawRuc.trim();
    if (!profileId || ruc.length === 0 || ruc === lastLookupRuc) return;
    setLastLookupRuc(ruc);

    try {
      const supplier = await window.metrion.findSupplierByRuc({ profileId, ruc });
      if (supplier) {
        applySuggestion({
          aliases: [supplier.name],
          key: `cataloged:${supplier.id}`,
          matchLabel: "Coincidencia por RUC",
          name: supplier.name,
          ruc: supplier.ruc,
          similarity: "exact",
          status: "cataloged",
          supplierId: supplier.id,
        });
      }
    } catch {
      // silent
    }
  }

  function applySuggestion(suggestion: SupplierSuggestion) {
    setValue("supplierName", suggestion.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedSupplierId(suggestion.supplierId);
    if (suggestion.ruc) {
      setValue("ruc", suggestion.ruc, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setShowSuggestions(false);
  }

  function buildDraftValues(): PurchaseFormValues {
    return {
      amount: watchedAmount,
      invoiceNumber: watchedInvoiceNumber,
      note: watchedNote,
      payment: watchedPayment,
      purchaseDate: watchedPurchaseDate,
      ruc: watchedRuc,
      supplierName: watchedSupplierName,
    };
  }

  function handleCreateSupplierInCatalog() {
    isNavigatingToSupplierCatalogRef.current = true;
    onCreateSupplierInCatalog({
      mode: purchase ? "edit" : "create",
      purchase: purchase ?? null,
      supplierId: selectedSupplierId,
      values: buildDraftValues(),
    });
    onOpenChange(false);
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

  const hasExactCatalogMatch = matchedSupplierByRuc !== null || matchedSupplierByExactName !== null;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isNavigatingToSupplierCatalogRef.current) {
          onCancel();
        }
        if (!nextOpen) {
          isNavigatingToSupplierCatalogRef.current = false;
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="w-[560px]">
        <DialogHeader>
          <DialogTitle>{purchase ? "Editar compra" : "Nueva compra"}</DialogTitle>
        </DialogHeader>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit(submit)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" error={errors.purchaseDate?.message}>
              <Input type="date" {...register("purchaseDate")} />
            </Field>
            <Field label="Factura" error={errors.invoiceNumber?.message}>
              <Input
                placeholder="Nro de factura…"
                {...register("invoiceNumber")}
              />
            </Field>
          </div>

          <Field label="Proveedor" error={errors.supplierName?.message}>
            <div className="space-y-2" ref={supplierFieldRef}>
              <Input
                autoComplete="off"
                onBlur={() => {
                  if (closeSuggestionsTimerRef.current) {
                    window.clearTimeout(closeSuggestionsTimerRef.current);
                  }
                  closeSuggestionsTimerRef.current = window.setTimeout(() => {
                    setShowSuggestions(false);
                  }, 120);
                }}
                onChange={(event) => {
                  setValue("supplierName", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Escribe el proveedor…"
                value={watchedSupplierName}
              />

              {showSuggestions && (watchedSupplierName.trim() || watchedRuc.trim()) && (
                <div className="rounded-lg border border-border bg-popover p-2 shadow-soft">
                  {suggestions.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {suggestions.map((suggestion) => (
                        <button
                          className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                          key={suggestion.key}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            applySuggestion(suggestion);
                          }}
                          type="button"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {suggestion.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {suggestion.status === "cataloged" ? "Catálogo" : "Pendiente"}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {suggestion.ruc ? `${suggestion.ruc} · ` : ""}
                              {suggestion.matchLabel}
                            </p>
                            {suggestion.aliases.length > 1 && (
                              <p className="truncate text-xs text-muted-foreground">
                                Alias: {suggestion.aliases.filter((alias) => alias !== suggestion.name).join(" · ")}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No hay coincidencias exactas en el catálogo.
                    </p>
                  )}

                  {!hasExactCatalogMatch && (
                    <div className="mt-2 border-t border-border pt-2">
                      <Button
                        className="w-full justify-start"
                        onClick={handleCreateSupplierInCatalog}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Crear proveedor en catálogo
                      </Button>
                      <p className="mt-2 px-1 text-xs text-muted-foreground">
                        La compra puede guardarse igual, pero crear el proveedor ayuda a reutilizarlo y normalizar meses anteriores.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {selectedSupplierId ? "Vinculado al catálogo" : "Compra libre; se puede normalizar después"}
                </span>
                <button
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  onClick={handleCreateSupplierInCatalog}
                  type="button"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Ir a Proveedores
                </button>
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="RUC (opcional)" error={errors.ruc?.message}>
              <Input
                maxLength={11}
                placeholder="11 dígitos…"
                {...rucField}
              />
            </Field>
            <Field label="Monto" error={errors.amount?.message}>
              <Input
                className="text-right"
                inputMode="decimal"
                placeholder="0.00…"
                {...register("amount")}
              />
            </Field>
          </div>

          <Field label="Pago" error={errors.payment?.message}>
            <Input
              placeholder="Ej: BCP, bancarizar, efectivo…"
              {...register("payment")}
            />
          </Field>

          <Field label="Nota" error={errors.note?.message}>
            <Textarea className="min-h-16" placeholder="Opcional…" {...register("note")} />
          </Field>

          {formError && <Alert variant="danger">{formError}</Alert>}

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
