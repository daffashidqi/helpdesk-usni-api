import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Generate nomor tiket unik format TIX-YYYY-00001, increment per tahun berjalan.
 * Harus dipanggil di dalam prisma transaction yang sama dengan `tx.ticket.create`
 * agar pencarian nomor terakhir & insert tiket baru atomic (mencegah duplikat
 * saat ada request bersamaan).
 */
export async function generateTicketNumber(
  tx: Prisma.TransactionClient | PrismaClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TIX-${year}-`;

  const lastTicket = await tx.ticket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  let nextSequence = 1;
  if (lastTicket) {
    const lastSequence = Number(lastTicket.ticketNumber.slice(prefix.length));
    if (!Number.isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(5, "0")}`;
}
