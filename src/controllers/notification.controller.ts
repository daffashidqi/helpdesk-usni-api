import type { Context } from "hono";
import { z } from "zod";
import {
  listNotifications,
  markAllAsRead,
  markAsRead,
} from "../services/notification.service";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export async function listNotificationsController(c: Context) {
  const user = c.get("user");
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ message: "Query tidak valid", errors: parsed.error.flatten() }, 400);
  }

  const result = await listNotifications(user.userId, parsed.data);
  return c.json(result, 200);
}

export async function markNotificationReadController(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const notification = await markAsRead(user.userId, id);
  if (!notification) {
    return c.json({ message: "Notifikasi tidak ditemukan" }, 404);
  }
  return c.json({ notification }, 200);
}

export async function markAllNotificationsReadController(c: Context) {
  const user = c.get("user");
  const count = await markAllAsRead(user.userId);
  return c.json({ message: `${count} notifikasi ditandai sudah dibaca` }, 200);
}
