import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const optionalMoney = z
  .number()
  .finite()
  .min(0)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const monthlySaleQuerySchema = z.object({
  profileId: z.number().int().positive(),
  businessUnitId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const monthlySaleInputSchema = monthlySaleQuerySchema.extend({
  totalAmount: z.number().finite().min(0, "Monto invalido"),
  saldoAnterior: optionalMoney,
  saldoSiguiente: optionalMoney,
  renta: optionalMoney,
  igvPago: optionalMoney,
  baseIgvManual: optionalMoney,
  nota: optionalText,
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
  saldoAnterior: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        (Number.isFinite(Number(value.replace(",", "."))) &&
          Number(value.replace(",", ".")) >= 0),
      { message: "Monto invalido" },
    ),
  saldoSiguiente: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        (Number.isFinite(Number(value.replace(",", "."))) &&
          Number(value.replace(",", ".")) >= 0),
      { message: "Monto invalido" },
    ),
  renta: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        (Number.isFinite(Number(value.replace(",", "."))) &&
          Number(value.replace(",", ".")) >= 0),
      { message: "Monto invalido" },
    ),
  igvPago: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        (Number.isFinite(Number(value.replace(",", "."))) &&
          Number(value.replace(",", ".")) >= 0),
      { message: "Monto invalido" },
    ),
  nota: z.string().trim(),
});

