import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validations/category.validation";

export async function listCategories() {
  return prisma.ticketCategory.findMany({
    include: { division: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createCategory(input: CreateCategoryInput) {
  const division = await prisma.division.findUnique({ where: { id: input.divisionId } });
  if (!division) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }

  return prisma.ticketCategory.create({
    data: {
      name: input.name,
      divisionId: input.divisionId,
      slaHours: input.slaHours,
      defaultUrgency: input.defaultUrgency,
    },
    include: { division: true },
  });
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const category = await prisma.ticketCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError("Kategori tidak ditemukan", 404);
  }

  if (input.divisionId) {
    const division = await prisma.division.findUnique({ where: { id: input.divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  return prisma.ticketCategory.update({
    where: { id },
    data: {
      name: input.name,
      divisionId: input.divisionId,
      slaHours: input.slaHours,
      defaultUrgency: input.defaultUrgency,
      isActive: input.isActive,
    },
    include: { division: true },
  });
}

export async function deleteCategory(id: string) {
  const category = await prisma.ticketCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError("Kategori tidak ditemukan", 404);
  }
  await prisma.ticketCategory.update({ where: { id }, data: { isActive: false } });
}
