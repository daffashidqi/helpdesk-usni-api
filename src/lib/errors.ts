import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function handleError(c: Context, err: unknown) {
  if (err instanceof AppError) {
    return c.json({ message: err.message }, err.status as ContentfulStatusCode);
  }
  throw err;
}

