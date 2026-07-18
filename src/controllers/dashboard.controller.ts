import type { Context } from "hono";
import { z } from "zod";
import { getCsat, getMttr, getSlaBreachRate, getSummary } from "../services/dashboard.service";
import { handleError } from "../lib/errors";

const rangeQuerySchema = z.object({
  divisionId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function summaryController(c: Context) {
  const user = c.get("user");
  const parsed = rangeQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }
  try {
    const summary = await getSummary(user, parsed.data.divisionId, parsed.data.dateFrom, parsed.data.dateTo);
    return c.json(summary, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function mttrController(c: Context) {
  const user = c.get("user");
  const parsed = rangeQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }
  try {
    const result = await getMttr(user, parsed.data);
    return c.json(result, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function slaBreachRateController(c: Context) {
  const user = c.get("user");
  const parsed = rangeQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }
  try {
    const result = await getSlaBreachRate(user, parsed.data);
    return c.json(result, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function csatController(c: Context) {
  const user = c.get("user");
  const parsed = rangeQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }
  try {
    const result = await getCsat(user, parsed.data);
    return c.json(result, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
