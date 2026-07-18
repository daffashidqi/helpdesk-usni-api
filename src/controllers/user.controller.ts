import type { Context } from "hono";
import {
  adminSetPasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "../validations/user.validation";
import {
  adminSetUserPassword,
  bulkUploadUsers,
  createUser,
  deactivateUser,
  hardDeleteUser,
  listUsers,
  updateUser,
} from "../services/user.service";
import { handleError } from "../lib/errors";

export async function listUsersController(c: Context) {
  const parsed = listUsersQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const result = await listUsers(parsed.data);
    return c.json(result, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function createUserController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const user = await createUser(parsed.data);
    return c.json({ user }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateUserController(c: Context) {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const user = await updateUser(id, parsed.data);
    return c.json({ user }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteUserController(c: Context) {
  const id = c.req.param("id")!;
  try {
    const user = await deactivateUser(id);
    return c.json({ message: "User berhasil dinonaktifkan", user }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function setUserPasswordController(c: Context) {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = adminSetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    await adminSetUserPassword(id, parsed.data);
    return c.json({ message: "Password user berhasil diubah" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function hardDeleteUserController(c: Context) {
  const id = c.req.param("id")!;
  const force = c.req.query("force") === "true";
  try {
    await hardDeleteUser(id, force);
    return c.json({ message: "User berhasil dihapus permanen" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

function parseCsv(text: string): { name: string; email: string; roleCode: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const roleCodeIdx = header.indexOf("rolecode");

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((col) => col.trim());
    return {
      name: cols[nameIdx] ?? "",
      email: cols[emailIdx] ?? "",
      roleCode: cols[roleCodeIdx] ?? "",
    };
  });
}

export async function bulkUploadUsersController(c: Context) {
  const body = await c.req.parseBody().catch(() => null);
  const file = body?.file;

  if (!(file instanceof File)) {
    return c.json({ message: "File CSV wajib diupload dengan field name 'file'" }, 400);
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return c.json({ message: "File harus berformat .csv" }, 400);
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return c.json({ message: "File CSV kosong atau format header tidak sesuai (name,email,roleCode)" }, 400);
  }

  const report = await bulkUploadUsers(rows);
  return c.json(report, 200);
}
