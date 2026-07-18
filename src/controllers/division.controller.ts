import type { Context } from "hono";
import { createDivisionSchema, updateDivisionSchema } from "../validations/division.validation";
import { createDivision, deleteDivision, listDivisions, updateDivision } from "../services/division.service";
import { handleError } from "../lib/errors";

export async function listDivisionsController(c: Context) {
  const divisions = await listDivisions();
  return c.json({ divisions }, 200);
}

export async function createDivisionController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = createDivisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const division = await createDivision({
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
    });
    return c.json({ division }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateDivisionController(c: Context) {
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateDivisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const division = await updateDivision(id, {
      code: parsed.data.code?.toUpperCase(),
      name: parsed.data.name,
    });
    return c.json({ division }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteDivisionController(c: Context) {
  const id = c.req.param("id")!;
  try {
    await deleteDivision(id);
    return c.json({ message: "Divisi berhasil dihapus" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
