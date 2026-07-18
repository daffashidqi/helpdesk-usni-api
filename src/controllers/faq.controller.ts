import type { Context } from "hono";
import { createFaqSchema, listFaqQuerySchema, updateFaqSchema } from "../validations/faq.validation";
import { createFaq, deleteFaq, getFaqById, listFaq, updateFaq } from "../services/faq.service";
import { handleError } from "../lib/errors";

export async function listFaqController(c: Context) {
  const user = c.get("user");
  const parsed = listFaqQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  const result = await listFaq(user, parsed.data);
  return c.json(result, 200);
}

export async function getFaqController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  try {
    const article = await getFaqById(user, id);
    return c.json({ article }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function createFaqController(c: Context) {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = createFaqSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const article = await createFaq(user, parsed.data);
    return c.json({ article }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateFaqController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateFaqSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const article = await updateFaq(user, id, parsed.data);
    return c.json({ article }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteFaqController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  try {
    await deleteFaq(user, id);
    return c.json({ message: "Artikel FAQ berhasil dihapus" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
