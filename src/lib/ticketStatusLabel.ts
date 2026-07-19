import type { TicketStatus } from "@prisma/client";

/**
 * Label Bahasa Indonesia untuk status tiket yang ditampilkan ke user.
 * Kode enum (OPEN, PENDING, RESOLVED, dst) TETAP dipakai sebagai nilai
 * internal (state machine, filter query, dsb) supaya tidak breaking —
 * hanya labelnya yang diterjemahkan di response API.
 */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Belum Ditangani",
  IN_PROGRESS: "Sedang Diproses",
  PENDING: "Tertunda",
  RESOLVED: "Sudah Selesai",
  CLOSED: "Ditutup",
  REOPENED: "Dibuka Kembali",
};

export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUS_LABEL[status];
}
