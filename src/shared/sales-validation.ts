import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const monthlySaleQuerySchema = z.object({
  profileId: z.number().int().positive(),
  businessUnitId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const monthlySaleInputSchema = monthlySaleQuerySchema.extend({
  totalAmount: z.number().finite().min(0, "Monto invalido"),
  observation: optionalText,
});

export const monthlySaleFormSchema = z.object({
  totalAmount: z
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
  observation: z.string().trim(),
});

