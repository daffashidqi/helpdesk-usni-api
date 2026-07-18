import { z } from "zod";

export const categoryUrgencyEnum = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(150),
  divisionId: z.string().min(1, "divisionId wajib diisi"),
  slaHours: z.coerce.number().int().min(1).max(24 * 30),
  defaultUrgency: categoryUrgencyEnum.optional().default("NORMAL"),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  divisionId: z.string().min(1).optional(),
  slaHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
  defaultUrgency: categoryUrgencyEnum.optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
