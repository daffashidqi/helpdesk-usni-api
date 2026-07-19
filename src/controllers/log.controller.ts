import type { Context } from "hono";
import { listLogsQuerySchema } from "../validations/log.validation";
import { listLogs } from "../services/log.service";

export async function listLogsController(c: Context) {
  const parsed = listLogsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  const result = await listLogs(parsed.data);
  return c.json(result, 200);
}
