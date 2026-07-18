import { prisma } from "../lib/prisma";
import { sendNotificationEmail } from "./email.service";

/**
 * Insert notifikasi in-app + kirim email (fire-and-forget). Kegagalan kirim
 * email TIDAK BOLEH menggagalkan alur utama (mis. create ticket, ubah status),
 * makanya email dibungkus try-catch sendiri dan tidak di-await secara blocking
 * terhadap caller (hasil promise-nya dibuang, hanya di-log jika gagal).
 */
export async function send(
  userId: string,
  title: string,
  message: string,
  type: string,
  relatedTicketId?: string
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      relatedTicketId: relatedTicketId ?? null,
    },
  });

  prisma.user
    .findUnique({ where: { id: userId }, select: { email: true } })
    .then((user) => {
      if (!user) return;
      return sendNotificationEmail(user.email, title, message);
    })
    .catch((err) => {
      console.error(`[notification.service] Gagal kirim email notifikasi ke user ${userId}:`, err);
    });

  return notification;
}

export async function sendToMany(
  userIds: string[],
  title: string,
  message: string,
  type: string,
  relatedTicketId?: string
) {
  await Promise.all(userIds.map((userId) => send(userId, title, message, type, relatedTicketId)));
}

export async function listNotifications(
  userId: string,
  params: { page: number; limit: number; isRead?: boolean }
) {
  const where = { userId, ...(params.isRead !== undefined ? { isRead: params.isRead } : {}) };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== userId) {
    return null;
  }
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}
