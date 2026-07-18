import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { comparePassword, hashPassword } from "./auth.service";
import { sendSetPasswordEmail, sendVerificationEmail } from "./email.service";
import type {
  AdminSetPasswordInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateProfileInput,
  UpdateProfilePasswordInput,
  UpdateUserInput,
} from "../validations/user.validation";

const SET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam
const DIVISION_REQUIRED_ROLE_CODES = ["IT", "AKADEMIK", "BUSP"];

const userSelect = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  role: true,
  divisionId: true,
  division: true,
  emailVerified: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function assertDivisionRequirement(roleId: string, divisionId: string | null | undefined) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new AppError("Role tidak ditemukan", 404);
  }
  if (DIVISION_REQUIRED_ROLE_CODES.includes(role.code) && !divisionId) {
    throw new AppError(`Role ${role.code} wajib memiliki divisionId`, 400);
  }
  if (divisionId) {
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }
  return role;
}

export async function listUsers(query: ListUsersQuery) {
  const where = {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.divisionId ? { divisionId: query.divisionId } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Email sudah terdaftar", 409);
  }

  await assertDivisionRequirement(input.roleId, input.divisionId);

  const rawPassword = input.password ?? generateOpaqueToken();
  const passwordHash = await hashPassword(rawPassword);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      roleId: input.roleId,
      divisionId: input.divisionId ?? null,
      emailVerified: new Date(),
    },
    select: userSelect,
  });

  const token = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + SET_PASSWORD_TOKEN_TTL_MS),
    },
  });

  await sendSetPasswordEmail(user.email, user.name, token);

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (input.email && input.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError("Email sudah terdaftar", 409);
    }
  }

  const nextRoleId = input.roleId ?? user.roleId;
  const nextDivisionId = input.divisionId !== undefined ? input.divisionId : user.divisionId;
  if (input.roleId !== undefined || input.divisionId !== undefined) {
    await assertDivisionRequirement(nextRoleId, nextDivisionId);
  }

  return prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      roleId: input.roleId,
      divisionId: input.divisionId,
      isActive: input.isActive,
    },
    select: userSelect,
  });
}

export async function deactivateUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }
  return prisma.user.update({
    where: { id },
    data: { isActive: false, refreshTokenHash: null },
    select: userSelect,
  });
}

export async function adminSetUserPassword(id: string, input: AdminSetPasswordInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, refreshTokenHash: null },
  });
}

export async function hardDeleteUser(id: string, force = false) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (!force) {
    try {
      await prisma.user.delete({ where: { id } });
      return;
    } catch (err) {
      // P2003: foreign key constraint gagal — user masih punya data terkait
      // (tiket, komentar, riwayat, dst). Beri tahu admin supaya bisa memilih
      // hapus paksa (force=true) atau menonaktifkan saja.
      if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
        throw new AppError(
          "User ini masih memiliki data terkait (tiket, komentar, atau riwayat) sehingga tidak bisa dihapus permanen. Gunakan opsi hapus paksa, atau nonaktifkan user sebagai gantinya.",
          409
        );
      }
      throw err;
    }
  }

  // Hapus paksa: bersihkan seluruh data yang terikat FK ke user ini supaya
  // penghapusan tidak gagal, meskipun user masih punya tiket/komentar/riwayat.
  await prisma.$transaction([
    // Komentar & riwayat yang ditulis user ini (di tiket manapun, termasuk
    // tiket milik orang lain) harus dihapus karena kolom userId wajib diisi.
    prisma.ticketComment.deleteMany({ where: { userId: id } }),
    prisma.ticketHistory.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    // Tiket yang di-assign ke user ini dilepas assignment-nya (kolom nullable).
    prisma.ticket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
    // Artikel FAQ yang ditulis user ini ikut dihapus (authorId wajib diisi).
    prisma.faqArticle.deleteMany({ where: { authorId: id } }),
    // Tiket yang DIBUAT user ini dihapus permanen — attachment/komentar/riwayat/
    // rating milik tiket tersebut ikut terhapus otomatis lewat onDelete: Cascade.
    prisma.ticket.deleteMany({ where: { createdById: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
}

interface BulkUploadRow {
  name: string;
  email: string;
  roleCode: string;
}

interface BulkUploadRowResult {
  row: number;
  email: string;
  success: boolean;
  reason?: string;
}

export async function bulkUploadUsers(rows: BulkUploadRow[]) {
  const results: BulkUploadRowResult[] = [];
  const roles = await prisma.role.findMany();
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  const divisions = await prisma.division.findMany();
  // CSV hanya punya kolom roleCode (tanpa divisionId). Untuk role yang butuh
  // divisi (IT/AKADEMIK/BUSP), divisionId di-derive otomatis dari Division
  // dengan code yang sama persis dengan role code (konvensi bawaan seed).
  const divisionByCode = new Map(divisions.map((d) => [d.code, d]));

  const emailSeen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // baris 1 adalah header CSV
    const row = rows[i];
    const email = row.email?.trim().toLowerCase();
    const name = row.name?.trim();
    const roleCode = row.roleCode?.trim().toUpperCase();

    if (!name || !email || !roleCode) {
      results.push({ row: rowNumber, email: email ?? "-", success: false, reason: "Kolom name/email/roleCode tidak lengkap" });
      continue;
    }

    if (!email.endsWith("@usni.ac.id") && !email.endsWith("@student.usni.ac.id")) {
      results.push({ row: rowNumber, email, success: false, reason: "Email harus domain @usni.ac.id atau @student.usni.ac.id" });
      continue;
    }

    if (emailSeen.has(email)) {
      results.push({ row: rowNumber, email, success: false, reason: "Duplikat email di dalam file CSV" });
      continue;
    }

    const role = roleByCode.get(roleCode);
    if (!role) {
      results.push({ row: rowNumber, email, success: false, reason: `roleCode "${roleCode}" tidak ditemukan` });
      continue;
    }

    let divisionId: string | null = null;
    if (DIVISION_REQUIRED_ROLE_CODES.includes(role.code)) {
      const division = divisionByCode.get(role.code);
      if (!division) {
        results.push({
          row: rowNumber,
          email,
          success: false,
          reason: `Role ${role.code} butuh divisi, tapi tidak ada Division dengan code "${role.code}"`,
        });
        continue;
      }
      divisionId = division.id;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      results.push({ row: rowNumber, email, success: false, reason: "Email sudah terdaftar" });
      continue;
    }

    try {
      const rawPassword = generateOpaqueToken();
      const passwordHash = await hashPassword(rawPassword);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          roleId: role.id,
          divisionId,
          emailVerified: new Date(),
        },
      });

      const token = generateOpaqueToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + SET_PASSWORD_TOKEN_TTL_MS),
        },
      });
      await sendSetPasswordEmail(user.email, user.name, token);

      emailSeen.add(email);
      results.push({ row: rowNumber, email, success: true });
    } catch (err) {
      results.push({ row: rowNumber, email, success: false, reason: "Gagal membuat user" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return {
    total: rows.length,
    success: successCount,
    failed: rows.length - successCount,
    results,
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const emailChanged = input.email !== undefined && input.email !== user.email;
  if (emailChanged) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError("Email sudah terdaftar", 409);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      email: input.email,
      emailVerified: emailChanged ? null : undefined,
    },
    select: userSelect,
  });

  if (emailChanged) {
    const token = generateOpaqueToken();
    await prisma.verificationToken.create({
      data: {
        email: updated.email,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(updated.email, token);
  }

  return updated;
}

export async function updateProfilePassword(userId: string, input: UpdateProfilePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const isValid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError("Password saat ini salah", 400);
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, refreshTokenHash: null },
  });
}
