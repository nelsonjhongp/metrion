import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const purchaseQuerySchema = z.object({
  profileId: z.number().int().positive(),
  businessUnitId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const purchaseInputSchema = purchaseQuerySchema.extend({
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha requerida"),
  ruc: z
    .string()
    .trim()
    .regex(/^\d{0,11}$/, "RUC invalido")
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional(),
  supplierName: z.string().trim().min(1, "Proveedor requerido"),
  invoiceNumber: optionalText,
  amount: z.number().finite().min(0, "Monto invalido"),
  payment: optionalText,
  note: optionalText,
});

export const purchaseUpdateInputSchema = purchaseInputSchema.extend({
  id: z.number().int().positive(),
});

export const purchaseFormSchema = z.object({
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha requerida"),
  ruc: z
    .string()
    .trim()
    .regex(/^\d{0,11}$/, "RUC invalido"),
  supplierName: z.string().trim().min(1, "Proveedor requerido"),
  invoiceNumber: z.string().trim(),
  amount: z
    .string()
    .trim()
    .min(1, "Monto requerido")
    .refine(
      (value) =>
        Number.isFinite(Number(value.replace(",", "."))) &&
        Number(value.replace(",", ".")) >= 0,
      {
        message: "Monto invalido",
      },
    ),
  payment: z.string().trim(),
  note: z.string().trim(),
});
