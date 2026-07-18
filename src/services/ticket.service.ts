import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { generateTicketNumber } from "../lib/ticketNumber";
import { hasDivisionAccess } from "../middlewares/auth.middleware";
import { saveTicketAttachment } from "./upload.service";
import * as notificationService from "./notification.service";
import type { AccessTokenPayload } from "../lib/jwt";
import type {
  AdminUpdateTicketInput,
  CreateCommentInput,
  CreateRatingInput,
  CreateTicketInput,
  ListTicketsQuery,
  ReassignDivisionInput,
  UpdateStatusInput,
} from "../validations/ticket.validation";

const AGENT_ROLE_CODES = ["IT", "AKADEMIK", "BUSP"];
const REOPEN_WINDOW_DAYS = 3;

const ticketDetailInclude = {
  category: true,
  division: true,
  createdBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  attachments: true,
  comments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
  histories: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
  rating: true,
} as const;

const ticketListInclude = {
  category: true,
  division: true,
  createdBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} as const;

function isAgent(user: AccessTokenPayload) {
  return AGENT_ROLE_CODES.includes(user.role);
}

async function recordHistory(
  tx: Prisma.TransactionClient | PrismaClient,
  ticketId: string,
  userId: string,
  action: string,
  fromValue: string | null,
  toValue: string | null
) {
  await tx.ticketHistory.create({
    data: { ticketId, userId, action, fromValue, toValue },
  });
}

async function assertTicketAccess(user: AccessTokenPayload, ticket: { createdById: string; divisionId: string }) {
  if (user.role === "ADMIN") return;
  if (user.role === "PELAPOR") {
    if (ticket.createdById !== user.userId) {
      throw new AppError("Anda tidak memiliki akses ke tiket ini", 403);
    }
    return;
  }
  if (isAgent(user)) {
    if (!hasDivisionAccess(user, ticket.divisionId)) {
      throw new AppError("Anda tidak memiliki akses ke tiket ini", 403);
    }
    return;
  }
  throw new AppError("Anda tidak memiliki akses ke tiket ini", 403);
}

export async function createTicket(user: AccessTokenPayload, input: CreateTicketInput, files: File[]) {
  const category = await prisma.ticketCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) {
    throw new AppError("Kategori tidak ditemukan atau sudah tidak aktif", 404);
  }

  const slaDeadline = new Date(Date.now() + category.slaHours * 60 * 60 * 1000);

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await generateTicketNumber(tx);

    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        categoryId: category.id,
        divisionId: category.divisionId,
        createdById: user.userId,
        slaDeadline,
      },
    });

    await recordHistory(tx, created.id, user.userId, "TICKET_CREATED", null, created.status);

    for (const file of files) {
      const saved = await saveTicketAttachment(created.id, file);
      await tx.ticketAttachment.create({
        data: {
          ticketId: created.id,
          fileName: saved.fileName,
          filePath: saved.filePath,
          fileSize: saved.fileSize,
          mimeType: saved.mimeType,
        },
      });
    }

    return created;
  });

  const agents = await prisma.user.findMany({
    where: { divisionId: category.divisionId, isActive: true, role: { code: { in: AGENT_ROLE_CODES } } },
    select: { id: true },
  });

  await notificationService.sendToMany(
    agents.map((a) => a.id),
    "Tiket Baru Masuk",
    `Tiket ${ticket.ticketNumber} - "${ticket.title}" masuk ke pool divisi Anda.`,
    "TICKET_ASSIGNED",
    ticket.id
  );

  return getTicketById(user, ticket.id);
}

export async function listTickets(user: AccessTokenPayload, query: ListTicketsQuery) {
  const where: Prisma.TicketWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.divisionId ? { divisionId: query.divisionId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.urgency ? { urgency: query.urgency } : {}),
    ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { ticketNumber: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (user.role === "PELAPOR") {
    where.createdById = user.userId;
  } else if (isAgent(user)) {
    where.divisionId = user.divisionId ?? "__none__";
  }
  // ADMIN: tidak ada filter tambahan, bisa lihat semua tiket

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketListInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.ticket.count({ where }),
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

export async function getTicketById(user: AccessTokenPayload, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketDetailInclude,
  });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }

  await assertTicketAccess(user, ticket);

  if (user.role === "PELAPOR") {
    ticket.comments = ticket.comments.filter((c) => !c.isInternal);
  }

  return ticket;
}

export async function adminUpdateTicket(
  user: AccessTokenPayload,
  ticketId: string,
  input: AdminUpdateTicketInput
) {
  if (user.role !== "ADMIN") {
    throw new AppError("Hanya ADMIN yang bisa mengedit tiket", 403);
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }

  let category = null;
  if (input.categoryId && input.categoryId !== ticket.categoryId) {
    category = await prisma.ticketCategory.findUnique({ where: { id: input.categoryId } });
    if (!category || !category.isActive) {
      throw new AppError("Kategori tidak ditemukan atau sudah tidak aktif", 404);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        ...(category ? { categoryId: category.id, divisionId: category.divisionId } : {}),
      },
    });
    await recordHistory(tx, ticketId, user.userId, "EDITED_BY_ADMIN", null, null);
  });

  return getTicketById(user, ticketId);
}

export async function deleteTicket(user: AccessTokenPayload, ticketId: string) {
  if (user.role !== "ADMIN") {
    throw new AppError("Hanya ADMIN yang bisa menghapus tiket", 403);
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }

  await prisma.ticket.delete({ where: { id: ticketId } });
}

export async function assignTicketToMe(user: AccessTokenPayload, ticketId: string) {
  if (!isAgent(user)) {
    throw new AppError("Hanya agen (IT/AKADEMIK/BUSP) yang bisa assign tiket", 403);
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }
  if (!hasDivisionAccess(user, ticket.divisionId)) {
    throw new AppError("Tiket ini bukan milik divisi Anda", 403);
  }
  if (ticket.status !== "OPEN") {
    throw new AppError(`Tiket dengan status ${ticket.status} tidak bisa di-assign`, 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: user.userId, status: "IN_PROGRESS" },
    });
    await recordHistory(tx, ticketId, user.userId, "ASSIGNED", ticket.status, "IN_PROGRESS");
  });

  await notificationService.send(
    ticket.createdById,
    "Tiket Anda Sedang Diproses",
    `Tiket ${ticket.ticketNumber} sudah di-assign ke agen dan sedang diproses.`,
    "STATUS_CHANGED",
    ticket.id
  );

  return getTicketById(user, ticketId);
}

export async function adminAssignTicket(user: AccessTokenPayload, ticketId: string, assigneeId: string) {
  if (user.role !== "ADMIN") {
    throw new AppError("Hanya ADMIN yang bisa assign tiket ke agen lain", 403);
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }

  const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, include: { role: true } });
  if (!assignee || !assignee.isActive) {
    throw new AppError("Agen tujuan tidak ditemukan atau tidak aktif", 404);
  }
  if (!AGENT_ROLE_CODES.includes(assignee.role.code) || assignee.divisionId !== ticket.divisionId) {
    throw new AppError("Agen tujuan harus berasal dari divisi yang sama dengan tiket ini", 400);
  }

  const previousAssigneeId = ticket.assignedToId;
  const nextStatus = ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: assignee.id, status: nextStatus },
    });
    await recordHistory(tx, ticketId, user.userId, "ASSIGNED_BY_ADMIN", previousAssigneeId, assignee.id);
  });

  await notificationService.send(
    assignee.id,
    "Tiket Baru Ditugaskan Untuk Anda",
    `Tiket ${ticket.ticketNumber} ditugaskan oleh admin ke Anda.`,
    "STATUS_CHANGED",
    ticket.id
  );
  if (ticket.createdById !== assignee.id) {
    await notificationService.send(
      ticket.createdById,
      "Tiket Anda Sedang Diproses",
      `Tiket ${ticket.ticketNumber} sudah di-assign ke agen dan sedang diproses.`,
      "STATUS_CHANGED",
      ticket.id
    );
  }

  return getTicketById(user, ticketId);
}

export async function reassignDivision(
  user: AccessTokenPayload,
  ticketId: string,
  input: ReassignDivisionInput
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }
  if (user.role !== "ADMIN" && !hasDivisionAccess(user, ticket.divisionId)) {
    throw new AppError("Anda tidak memiliki akses ke tiket ini", 403);
  }

  const newCategory = await prisma.ticketCategory.findUnique({ where: { id: input.newCategoryId } });
  if (!newCategory || !newCategory.isActive) {
    throw new AppError("Kategori tujuan tidak ditemukan atau sudah tidak aktif", 404);
  }

  const previousDivisionId = ticket.divisionId;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        categoryId: newCategory.id,
        divisionId: newCategory.divisionId,
        assignedToId: null,
        status: "OPEN",
      },
    });
    await recordHistory(
      tx,
      ticketId,
      user.userId,
      "REASSIGNED_DIVISION",
      previousDivisionId,
      newCategory.divisionId
    );
  });

  const newAgents = await prisma.user.findMany({
    where: { divisionId: newCategory.divisionId, isActive: true, role: { code: { in: AGENT_ROLE_CODES } } },
    select: { id: true },
  });

  await notificationService.sendToMany(
    newAgents.map((a) => a.id),
    "Tiket Dipindahkan ke Divisi Anda",
    `Tiket ${ticket.ticketNumber} - "${ticket.title}" dipindahkan ke divisi Anda dan perlu di-assign ulang.`,
    "TICKET_ASSIGNED",
    ticket.id
  );

  return getTicketById(user, ticketId);
}

const AGENT_DRIVEN_TRANSITIONS: Record<string, string[]> = {
  IN_PROGRESS: ["PENDING", "RESOLVED"],
  PENDING: ["IN_PROGRESS", "RESOLVED"],
  REOPENED: ["IN_PROGRESS", "PENDING", "RESOLVED"],
};

export async function updateTicketStatus(
  user: AccessTokenPayload,
  ticketId: string,
  input: UpdateStatusInput
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }

  const targetStatus = input.status;

  if (targetStatus === "CLOSED") {
    if (ticket.createdById !== user.userId) {
      throw new AppError("Hanya pembuat tiket yang bisa konfirmasi CLOSED", 403);
    }
    if (ticket.status !== "RESOLVED") {
      throw new AppError(`Tiket harus berstatus RESOLVED sebelum bisa di-CLOSED (saat ini ${ticket.status})`, 400);
    }
  } else {
    if (!isAgent(user)) {
      throw new AppError("Hanya agen (IT/AKADEMIK/BUSP) yang bisa mengubah status ini", 403);
    }
    if (!hasDivisionAccess(user, ticket.divisionId)) {
      throw new AppError("Tiket ini bukan milik divisi Anda", 403);
    }
    const allowedTargets = AGENT_DRIVEN_TRANSITIONS[ticket.status] ?? [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new AppError(`Tidak bisa mengubah status dari ${ticket.status} ke ${targetStatus}`, 400);
    }
  }

  const now = new Date();
  const data: Prisma.TicketUpdateInput = { status: targetStatus };
  if (targetStatus === "RESOLVED") {
    data.resolvedAt = now;
    data.slaBreached = ticket.slaDeadline ? now > ticket.slaDeadline : false;
  }
  if (targetStatus === "CLOSED") {
    data.closedAt = now;
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticketId }, data });
    await recordHistory(tx, ticketId, user.userId, "STATUS_CHANGED", ticket.status, targetStatus);
  });

  const notifyTargets = new Set<string>();
  if (ticket.createdById !== user.userId) notifyTargets.add(ticket.createdById);
  if (ticket.assignedToId && ticket.assignedToId !== user.userId) notifyTargets.add(ticket.assignedToId);

  await notificationService.sendToMany(
    Array.from(notifyTargets),
    "Status Tiket Diperbarui",
    `Tiket ${ticket.ticketNumber} berubah status dari ${ticket.status} menjadi ${targetStatus}.`,
    "STATUS_CHANGED",
    ticket.id
  );

  return getTicketById(user, ticketId);
}

export async function reopenTicket(user: AccessTokenPayload, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }
  if (ticket.createdById !== user.userId) {
    throw new AppError("Hanya pembuat tiket yang bisa reopen tiket", 403);
  }
  if (ticket.status !== "CLOSED") {
    throw new AppError("Hanya tiket berstatus CLOSED yang bisa di-reopen", 400);
  }
  if (!ticket.closedAt) {
    throw new AppError("Tiket tidak memiliki tanggal closed yang valid", 400);
  }

  const deadline = new Date(ticket.closedAt.getTime() + REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (new Date() > deadline) {
    throw new AppError(`Batas waktu reopen (${REOPEN_WINDOW_DAYS} hari setelah closed) sudah lewat`, 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticketId }, data: { status: "REOPENED" } });
    await recordHistory(tx, ticketId, user.userId, "REOPENED", "CLOSED", "REOPENED");
  });

  if (ticket.assignedToId) {
    await notificationService.send(
      ticket.assignedToId,
      "Tiket Dibuka Kembali",
      `Tiket ${ticket.ticketNumber} dibuka kembali oleh pelapor.`,
      "STATUS_CHANGED",
      ticket.id
    );
  }

  return getTicketById(user, ticketId);
}

export async function addComment(user: AccessTokenPayload, ticketId: string, input: CreateCommentInput) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }
  await assertTicketAccess(user, ticket);

  const isInternal = input.isInternal && (user.role === "ADMIN" || isAgent(user));

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      userId: user.userId,
      content: input.content,
      isInternal,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: user.userId,
      action: "COMMENT_ADDED",
      fromValue: null,
      toValue: isInternal ? "internal" : "public",
    },
  });

  const notifyTargets = new Set<string>();
  if (ticket.assignedToId && ticket.assignedToId !== user.userId) notifyTargets.add(ticket.assignedToId);
  if (!isInternal && ticket.createdById !== user.userId) notifyTargets.add(ticket.createdById);

  await notificationService.sendToMany(
    Array.from(notifyTargets),
    "Komentar Baru pada Tiket",
    `Ada komentar baru pada tiket ${ticket.ticketNumber}.`,
    "TICKET_COMMENT",
    ticket.id
  );

  return comment;
}

export async function addRating(user: AccessTokenPayload, ticketId: string, input: CreateRatingInput) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { rating: true } });
  if (!ticket) {
    throw new AppError("Tiket tidak ditemukan", 404);
  }
  if (ticket.createdById !== user.userId) {
    throw new AppError("Hanya pembuat tiket yang bisa memberi rating", 403);
  }
  if (ticket.status !== "CLOSED") {
    throw new AppError("Rating hanya bisa diberikan untuk tiket berstatus CLOSED", 400);
  }
  if (ticket.rating) {
    throw new AppError("Tiket ini sudah pernah diberi rating", 409);
  }

  return prisma.ticketRating.create({
    data: {
      ticketId,
      score: input.score,
      feedback: input.feedback,
    },
  });
}
