import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { AccessTokenPayload } from "../lib/jwt";
import type { ListRatingsQuery } from "../validations/rating.validation";

const AGENT_ROLE_CODES = ["IT", "AKADEMIK", "BUSP"];

const ratingInclude = {
  ticket: {
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      division: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

export async function listRatings(user: AccessTokenPayload, query: ListRatingsQuery) {
  let where: Prisma.TicketRatingWhereInput = {};

  if (user.role === "ADMIN") {
    where = {};
  } else if (AGENT_ROLE_CODES.includes(user.role)) {
    // Setiap agen hanya melihat rating dari tiket yang dia selesaikan sendiri
    // (assignedToId = dirinya), bukan rating milik agen lain.
    where = { ticket: { assignedToId: user.userId } };
  } else {
    throw new AppError("Hanya ADMIN dan agen yang bisa melihat data rating", 403);
  }

  const [items, total] = await Promise.all([
    prisma.ticketRating.findMany({
      where,
      include: ratingInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.ticketRating.count({ where }),
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
