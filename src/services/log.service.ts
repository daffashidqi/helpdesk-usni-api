import { prisma } from "../lib/prisma";
import type { ListLogsQuery } from "../validations/log.validation";

const logInclude = {
  user: { select: { id: true, name: true, email: true } },
  ticket: {
    select: {
      id: true,
      ticketNumber: true,
      title: true,
    },
  },
} as const;

/**
 * Log aktivitas sistem: seluruh riwayat perubahan tiket (TicketHistory) di
 * semua tiket, lintas divisi. Khusus ADMIN — dijaga di route layer.
 */
export async function listLogs(query: ListLogsQuery) {
  const [items, total] = await Promise.all([
    prisma.ticketHistory.findMany({
      include: logInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.ticketHistory.count(),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
