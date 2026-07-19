import { z } from "zod";

export const urgencyEnum = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
export const ticketStatusEnum = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
]);

// Dipakai untuk multipart/form-data (field selain file datang sebagai string)
export const createTicketSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10),
  categoryId: z.string().min(1, "categoryId wajib diisi"),
  urgency: urgencyEnum.optional().default("NORMAL"),
});

export const listTicketsQuerySchema = z.object({
  status: ticketStatusEnum.optional(),
  divisionId: z.string().optional(),
  categoryId: z.string().optional(),
  urgency: urgencyEnum.optional(),
  assignedToId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateTicketSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).optional(),
  categoryId: z.string().min(1).optional(),
  urgency: urgencyEnum.optional(),
  status: ticketStatusEnum.optional(),
});

export const reassignDivisionSchema = z.object({
  newCategoryId: z.string().min(1, "newCategoryId wajib diisi"),
});

export const updateStatusSchema = z.object({
  status: ticketStatusEnum,
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Komentar tidak boleh kosong").max(5000),
  isInternal: z.boolean().optional().default(false),
});

export const createRatingSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AdminUpdateTicketInput = z.infer<typeof adminUpdateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type ReassignDivisionInput = z.infer<typeof reassignDivisionSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
