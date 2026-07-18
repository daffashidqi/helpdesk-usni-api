import { z } from "zod";

const usniEmail = z
  .string()
  .email("Format email tidak valid")
  .refine(
    (email) => email.endsWith("@usni.ac.id") || email.endsWith("@student.usni.ac.id"),
    "Email harus menggunakan domain @usni.ac.id atau @student.usni.ac.id"
  );

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: usniEmail,
  roleId: z.string().min(1, "roleId wajib diisi"),
  divisionId: z.string().min(1).optional(),
  password: z.string().min(8).max(72).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: usniEmail.optional(),
  roleId: z.string().min(1).optional(),
  divisionId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  roleId: z.string().optional(),
  divisionId: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: usniEmail.optional(),
});

export const adminSetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password baru minimal 8 karakter").max(72),
});

export const updateProfilePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter").max(72),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateProfilePasswordInput = z.infer<typeof updateProfilePasswordSchema>;
export type AdminSetPasswordInput = z.infer<typeof adminSetPasswordSchema>;
