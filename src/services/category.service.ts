import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { AccessTokenPayload } from "../lib/jwt";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validations/category.validation";

const AGENT_ROLE_CODES = ["IT", "AKADEMIK", "BUSP"];

export async function listCategories() {
  return prisma.ticketCategory.findMany({
    include: { division: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createCategory(user: AccessTokenPayload, input: CreateCategoryInput) {
  // Agen (bukan ADMIN) hanya boleh membuat kategori untuk divisi mereka sendiri —
  // divisionId dari input diabaikan dan dipaksa memakai divisi milik user.
  const divisionId = user.role === "ADMIN" ? input.divisionId : user.divisionId;
  if (!divisionId) {
    throw new AppError("User ini tidak memiliki divisi", 400);
  }

  const division = await prisma.division.findUnique({ where: { id: divisionId } });
  if (!division) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }

  return prisma.ticketCategory.create({
    data: {
      name: input.name,
      divisionId,
      slaHours: input.slaHours,
      defaultUrgency: input.defaultUrgency,
    },
    include: { division: true },
  });
}

async function assertCategoryDivisionAccess(user: AccessTokenPayload, categoryDivisionId: string) {
  if (user.role === "ADMIN") return;
  if (!AGENT_ROLE_CODES.includes(user.role) || user.divisionId !== categoryDivisionId) {
    throw new AppError("Anda hanya bisa mengelola kategori pada divisi Anda sendiri", 403);
  }
}

export async function updateCategory(user: AccessTokenPayload, id: string, input: UpdateCategoryInput) {
  const category = await prisma.ticketCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError("Kategori tidak ditemukan", 404);
  }
  await assertCategoryDivisionAccess(user, category.divisionId);

  // Agen tidak boleh memindahkan kategori ke divisi lain, hanya ADMIN yang boleh.
  const divisionId = user.role === "ADMIN" ? input.divisionId : undefined;
  if (divisionId) {
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  return prisma.ticketCategory.update({
    where: { id },
    data: {
      name: input.name,
      divisionId,
      slaHours: input.slaHours,
      defaultUrgency: input.defaultUrgency,
      isActive: input.isActive,
    },
    include: { division: true },
  });
}

export async function deleteCategory(user: AccessTokenPayload, id: string) {
  const category = await prisma.ticketCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError("Kategori tidak ditemukan", 404);
  }
  await assertCategoryDivisionAccess(user, category.divisionId);
  await prisma.ticketCategory.update({ where: { id }, data: { isActive: false } });
}
