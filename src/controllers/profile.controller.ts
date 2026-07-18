import type { Context } from "hono";
import { updateProfilePasswordSchema, updateProfileSchema } from "../validations/user.validation";
import { updateProfile, updateProfilePassword } from "../services/user.service";
import { handleError } from "../lib/errors";

export async function updateProfileController(c: Context) {
  const payload = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const user = await updateProfile(payload.userId, parsed.data);
    return c.json({ user }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function updateProfilePasswordController(c: Context) {
  const payload = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfilePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    await updateProfilePassword(payload.userId, parsed.data);
    return c.json({ message: "Password berhasil diperbarui" }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
