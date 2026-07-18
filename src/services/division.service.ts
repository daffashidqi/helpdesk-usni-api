import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { CreateDivisionInput, UpdateDivisionInput } from "../validations/division.validation";

export async function listDivisions() {
  return prisma.division.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createDivision(input: CreateDivisionInput) {
  const existing = await prisma.division.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Code divisi sudah digunakan", 409);
  }
  return prisma.division.create({
    data: { code: input.code, name: input.name, isSystem: false },
  });
}

export async function updateDivision(id: string, input: UpdateDivisionInput) {
  const division = await prisma.division.findUnique({ where: { id } });
  if (!division) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }

  if (input.code !== undefined && input.code !== division.code) {
    if (division.isSystem) {
      throw new AppError("Code divisi bawaan sistem tidak boleh diubah", 403);
    }
    const existing = await prisma.division.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new AppError("Code divisi sudah digunakan", 409);
    }
  }

  return prisma.division.update({
    where: { id },
    data: { code: input.code, name: input.name },
  });
}

export async function deleteDivision(id: string) {
  const division = await prisma.division.findUnique({ where: { id } });
  if (!division) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }
  if (division.isSystem) {
    throw new AppError("Divisi bawaan sistem tidak boleh dihapus", 403);
  }

  const [userCount, categoryCount, ticketCount] = await Promise.all([
    prisma.user.count({ where: { divisionId: id } }),
    prisma.ticketCategory.count({ where: { divisionId: id } }),
    prisma.ticket.count({ where: { divisionId: id } }),
  ]);

  if (userCount > 0 || categoryCount > 0 || ticketCount > 0) {
    throw new AppError(
      `Divisi masih digunakan oleh ${userCount} user, ${categoryCount} kategori, dan ${ticketCount} tiket`,
      409
    );
  }

  await prisma.division.delete({ where: { id } });
}
