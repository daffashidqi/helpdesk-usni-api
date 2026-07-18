import type { Context } from "hono";
import { createRoleSchema, updateRoleSchema } from "../validations/role.validation";
import { createRole, deleteRole, listRoles, updateRole } from "../services/role.service";
import { handleError } from "../lib/errors";

export async function listRolesController(c: Context) {
  const roles = await listRoles();
  return c.json({ roles }, 200);
}

export async function createRoleController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const role = await createRole({ code: parsed.data.code.toUpperCase(), name: parsed.data.name });
    return c.json({ role }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateRoleController(c: Context) {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const role = await updateRole(id, {
      code: parsed.data.code?.toUpperCase(),
      name: parsed.data.name,
    });
    return c.json({ role }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteRoleController(c: Context) {
  const id = c.req.param("id")!;
  try {
    await deleteRole(id);
    return c.json({ message: "Role berhasil dihapus" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
