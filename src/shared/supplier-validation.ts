import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const supplierQuerySchema = z.object({
  profileId: z.number().int().positive(),
});

export const supplierLookupQuerySchema = supplierQuerySchema.extend({
  ruc: z.string().trim().regex(/^\d{1,11}$/, "RUC invalido"),
});

export const supplierInputSchema = supplierQuerySchema.extend({
  ruc: z
    .string()
    .trim()
    .regex(/^\d{0,11}$/, "RUC invalido")
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional(),
  name: z.string().trim().min(1, "Nombre requerido"),
  note: optionalText,
});

export const supplierUpdateInputSchema = supplierInputSchema.extend({
  id: z.number().int().positive(),
});

export const supplierFormSchema = z.object({
  ruc: z.string().trim().regex(/^\d{0,11}$/, "RUC invalido"),
  name: z.string().trim().min(1, "Nombre requerido"),
  note: z.string().trim(),
});
