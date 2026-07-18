import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { CreateRoleInput, UpdateRoleInput } from "../validations/role.validation";

export async function listRoles() {
  return prisma.role.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createRole(input: CreateRoleInput) {
  const existing = await prisma.role.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Code role sudah digunakan", 409);
  }
  return prisma.role.create({
    data: { code: input.code, name: input.name, isSystem: false },
  });
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new AppError("Role tidak ditemukan", 404);
  }

  if (input.code !== undefined && input.code !== role.code) {
    if (role.isSystem) {
      throw new AppError("Code role bawaan sistem tidak boleh diubah", 403);
    }
    const existing = await prisma.role.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new AppError("Code role sudah digunakan", 409);
    }
  }

  return prisma.role.update({
    where: { id },
    data: { code: input.code, name: input.name },
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new AppError("Role tidak ditemukan", 404);
  }
  if (role.isSystem) {
    throw new AppError("Role bawaan sistem tidak boleh dihapus", 403);
  }

  const userCount = await prisma.user.count({ where: { roleId: id } });
  if (userCount > 0) {
    throw new AppError(`Role masih digunakan oleh ${userCount} user`, 409);
  }

  await prisma.role.delete({ where: { id } });
}
