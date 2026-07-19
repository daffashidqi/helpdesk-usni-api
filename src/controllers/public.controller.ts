import type { Context } from "hono";
import { publicFaqQuerySchema } from "../validations/faq.validation";
import { listPublicFaq } from "../services/faq.service";

export async function listPublicFaqController(c: Context) {
  const parsed = publicFaqQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  const items = await listPublicFaq(parsed.data);
  return c.json({ items }, 200);
}
