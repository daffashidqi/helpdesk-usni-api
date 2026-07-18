import { z } from "zod";

const usniEmail = z
  .string()
  .email("Format email tidak valid")
  .refine(
    (email) => email.endsWith("@usni.ac.id") || email.endsWith("@student.usni.ac.id"),
    "Email harus menggunakan domain @usni.ac.id atau @student.usni.ac.id"
  );

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: usniEmail,
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
  captchaToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token wajib diisi"),
  newPassword: z.string().min(8, "Password minimal 8 karakter").max(72),
});

export const verifyEmailQuerySchema = z.object({
  token: z.string().min(1, "Token wajib diisi"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
