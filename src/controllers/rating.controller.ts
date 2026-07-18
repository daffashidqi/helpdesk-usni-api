import type { Context } from "hono";
import { listRatingsQuerySchema } from "../validations/rating.validation";
import { listRatings } from "../services/rating.service";
import { handleError } from "../lib/errors";

export async function listRatingsController(c: Context) {
  const user = c.get("user");
  const parsed = listRatingsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const result = await listRatings(user, parsed.data);
    return c.json(result, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
