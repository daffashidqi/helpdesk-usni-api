import { z } from "zod";

const codePattern = /^[A-Z0-9_]+$/;

export const createRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(codePattern, "Code hanya boleh huruf kapital, angka, dan underscore"),
  name: z.string().trim().min(2).max(100),
});

export const updateRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(codePattern, "Code hanya boleh huruf kapital, angka, dan underscore")
    .optional(),
  name: z.string().trim().min(2).max(100).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
