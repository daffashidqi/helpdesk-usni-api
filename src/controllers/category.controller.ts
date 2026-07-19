import type { Context } from "hono";
import { createCategorySchema, updateCategorySchema } from "../validations/category.validation";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../services/category.service";
import { handleError } from "../lib/errors";

export async function listCategoriesController(c: Context) {
  const categories = await listCategories();
  return c.json({ categories }, 200);
}

export async function createCategoryController(c: Context) {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const category = await createCategory(user, parsed.data);
    return c.json({ category }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateCategoryController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const category = await updateCategory(user, id, parsed.data);
    return c.json({ category }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function deleteCategoryController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  try {
    await deleteCategory(user, id);
    return c.json({ message: "Kategori berhasil dinonaktifkan" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
