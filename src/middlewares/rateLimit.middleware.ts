import { rateLimiter } from "hono-rate-limiter";
import type { Context } from "hono";

// Rate limiting in-memory, cocok untuk deployment single-instance (~150 user).
// Jika nanti di-deploy dengan multiple instance/replica, ganti store default
// dengan Redis store (ioredis / @upstash/redis) agar counter konsisten antar instance.
export const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // window 1 menit
  limit: 10, // maksimal 10 request per menit per IP
  standardHeaders: "draft-6",
  keyGenerator: (c: Context) => {
    return c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  },
  message: "Terlalu banyak percobaan. Coba lagi dalam beberapa saat.",
});
