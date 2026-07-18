import { z } from "zod";

const codePattern = /^[A-Z0-9_]+$/;

export const createDivisionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(codePattern, "Code hanya boleh huruf kapital, angka, dan underscore"),
  name: z.string().trim().min(2).max(100),
});

export const updateDivisionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(codePattern, "Code hanya boleh huruf kapital, angka, dan underscore")
    .optional(),
  name: z.string().trim().min(2).max(100).optional(),
});

export type CreateDivisionInput = z.infer<typeof createDivisionSchema>;
export type UpdateDivisionInput = z.infer<typeof updateDivisionSchema>;
