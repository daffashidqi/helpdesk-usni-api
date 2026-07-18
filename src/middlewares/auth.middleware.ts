import type { Context, Next } from "hono";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt";

declare module "hono" {
  interface ContextVariableMap {
    user: AccessTokenPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ message: "Token tidak ditemukan" }, 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = await verifyAccessToken(token);
    c.set("user", payload);
  } catch {
    return c.json({ message: "Token tidak valid atau kedaluwarsa" }, 401);
  }

  await next();
}

export function roleGuard(...allowedRoleCodes: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user || !allowedRoleCodes.includes(user.role)) {
      return c.json({ message: "Anda tidak memiliki akses ke resource ini" }, 403);
    }
    await next();
  };
}

/**
 * Helper (bukan middleware Hono biasa) khusus modul ticketing: memastikan agen
 * IT/AKADEMIK/BUSP hanya bisa mengakses/mengaksi resource yang divisionId-nya
 * sama dengan divisionId user tsb. Dipanggil di controller setelah resource
 * (mis. ticket) di-fetch, karena butuh divisionId milik resource tersebut.
 * ADMIN selalu lolos (bypass) karena berhak akses semua divisi.
 */
export function hasDivisionAccess(
  user: AccessTokenPayload,
  resourceDivisionId: string | null | undefined
): boolean {
  if (user.role === "ADMIN") return true;
  if (!user.divisionId || !resourceDivisionId) return false;
  return user.divisionId === resourceDivisionId;
}
