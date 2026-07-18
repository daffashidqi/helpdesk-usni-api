import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from "../lib/jwt";
import { AppError } from "../lib/errors";
import { verifyRecaptcha } from "../lib/recaptcha";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service";

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam
const DEFAULT_ROLE_CODE = "PELAPOR";

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

export { AppError as AuthError };

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  captchaToken?: string;
}) {
  await verifyRecaptcha(input.captchaToken);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email sudah terdaftar", 409);
  }

  const defaultRole = await prisma.role.findUnique({ where: { code: DEFAULT_ROLE_CODE } });
  if (!defaultRole) {
    throw new AppError("Role default PELAPOR belum di-seed, hubungi administrator", 500);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      roleId: defaultRole.id,
    },
  });

  const token = generateOpaqueToken();
  await prisma.verificationToken.create({
    data: {
      email: user.email,
      token,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });

  await sendVerificationEmail(user.email, token);

  return { id: user.id, name: user.name, email: user.email };
}

export async function verifyEmail(token: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) {
    throw new AppError("Token verifikasi tidak valid", 400);
  }
  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { id: record.id } });
    throw new AppError("Token verifikasi sudah kedaluwarsa", 400);
  }

  await prisma.user.update({
    where: { email: record.email },
    data: { emailVerified: new Date() },
  });

  await prisma.verificationToken.delete({ where: { id: record.id } });
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true, division: true },
  });
  if (!user) {
    throw new AppError("Email atau password salah", 401);
  }
  if (!user.isActive) {
    throw new AppError("Akun tidak aktif, hubungi administrator", 403);
  }
  if (!user.emailVerified) {
    throw new AppError("Email belum diverifikasi", 403);
  }

  const isValid = await comparePassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError("Email atau password salah", 401);
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role.code,
    divisionId: user.divisionId,
  });
  const jti = generateOpaqueToken();
  const refreshToken = await signRefreshToken({ userId: user.id, jti });
  const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.code,
      division: user.division?.code ?? null,
    },
  };
}

export async function refreshSession(refreshToken: string) {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Refresh token tidak valid atau kedaluwarsa", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  });
  if (!user || !user.refreshTokenHash) {
    throw new AppError("Sesi tidak valid", 401);
  }

  const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!matches) {
    throw new AppError("Sesi tidak valid", 401);
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role.code,
    divisionId: user.divisionId,
  });
  const jti = generateOpaqueToken();
  const newRefreshToken = await signRefreshToken({ userId: user.id, jti });
  const refreshTokenHash = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return;
  }

  const token = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    throw new AppError("Token reset password tidak valid atau kedaluwarsa", 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, refreshTokenHash: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
  ]);
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, division: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.code,
    division: user.division?.code ?? null,
    isActive: user.isActive,
  };
}

export type { AccessTokenPayload };
