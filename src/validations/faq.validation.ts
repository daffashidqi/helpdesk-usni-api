import { z } from "zod";

export const createFaqSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10),
  divisionId: z.string().min(1).nullable().optional(),
  isPublished: z.boolean().optional().default(true),
  showOnHomepage: z.boolean().optional().default(false),
});

export const updateFaqSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  content: z.string().trim().min(10).optional(),
  divisionId: z.string().min(1).nullable().optional(),
  isPublished: z.boolean().optional(),
  showOnHomepage: z.boolean().optional(),
});

export const listFaqQuerySchema = z.object({
  search: z.string().trim().optional(),
  divisionId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const publicFaqQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(5).default(5),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
export type ListFaqQuery = z.infer<typeof listFaqQuerySchema>;
export type PublicFaqQuery = z.infer<typeof publicFaqQuerySchema>;
