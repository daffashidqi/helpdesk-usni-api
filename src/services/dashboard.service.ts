import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { AccessTokenPayload } from "../lib/jwt";

const AGENT_ROLE_CODES = ["IT", "AKADEMIK", "BUSP"];

function resolveDivisionFilter(user: AccessTokenPayload, requestedDivisionId?: string): string | undefined {
  if (user.role === "ADMIN") {
    return requestedDivisionId;
  }
  if (AGENT_ROLE_CODES.includes(user.role)) {
    if (!user.divisionId) {
      throw new AppError("User ini tidak memiliki divisi", 400);
    }
    return user.divisionId;
  }
  throw new AppError("Dashboard hanya tersedia untuk ADMIN dan agen divisi", 403);
}

function resolveDateRange(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : undefined;
  const to = dateTo ? new Date(dateTo) : undefined;
  return { from, to };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = startOfToday();
  const day = d.getDay();
  const diff = (day + 6) % 7; // Senin sebagai awal minggu
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth() {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

export async function getSummary(
  user: AccessTokenPayload,
  requestedDivisionId?: string,
  dateFrom?: string,
  dateTo?: string
) {
  const divisionId = resolveDivisionFilter(user, requestedDivisionId);
  const { from, to } = resolveDateRange(dateFrom, dateTo);
  const where: Prisma.TicketWhereInput = {
    ...(divisionId ? { divisionId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [total, byStatus, byDivision, createdToday, createdThisWeek, createdThisMonth] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.groupBy({ by: ["status"], where, _count: { _all: true } }),
    user.role === "ADMIN"
      ? prisma.ticket.groupBy({ by: ["divisionId"], where, _count: { _all: true } })
      : Promise.resolve([]),
    prisma.ticket.count({ where: { ...where, createdAt: { gte: startOfToday() } } }),
    prisma.ticket.count({ where: { ...where, createdAt: { gte: startOfWeek() } } }),
    prisma.ticket.count({ where: { ...where, createdAt: { gte: startOfMonth() } } }),
  ]);

  let divisionBreakdown: { divisionId: string; divisionName: string; total: number }[] = [];
  if (user.role === "ADMIN" && byDivision.length > 0) {
    const divisions = await prisma.division.findMany({
      where: { id: { in: byDivision.map((d) => d.divisionId) } },
    });
    const nameById = new Map(divisions.map((d) => [d.id, d.name]));
    divisionBreakdown = byDivision.map((d) => ({
      divisionId: d.divisionId,
      divisionName: nameById.get(d.divisionId) ?? "-",
      total: d._count._all,
    }));
  }

  return {
    total,
    byStatus: byStatus.map((s) => ({ status: s.status, total: s._count._all })),
    byDivision: divisionBreakdown,
    createdToday,
    createdThisWeek,
    createdThisMonth,
  };
}

export async function getMttr(user: AccessTokenPayload, params: { divisionId?: string; dateFrom?: string; dateTo?: string }) {
  const divisionId = resolveDivisionFilter(user, params.divisionId);
  const { from, to } = resolveDateRange(params.dateFrom, params.dateTo);

  const where: Prisma.TicketWhereInput = {
    ...(divisionId ? { divisionId } : {}),
    resolvedAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
  };

  const resolvedTickets = await prisma.ticket.findMany({
    where,
    select: { createdAt: true, resolvedAt: true },
  });

  if (resolvedTickets.length === 0) {
    return { mttrHours: 0, sampleSize: 0 };
  }

  const totalMs = resolvedTickets.reduce((sum, t) => {
    return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime());
  }, 0);

  const mttrHours = totalMs / resolvedTickets.length / (1000 * 60 * 60);

  return { mttrHours: Number(mttrHours.toFixed(2)), sampleSize: resolvedTickets.length };
}

export async function getSlaBreachRate(user: AccessTokenPayload, params: { divisionId?: string; dateFrom?: string; dateTo?: string }) {
  const divisionId = resolveDivisionFilter(user, params.divisionId);
  const { from, to } = resolveDateRange(params.dateFrom, params.dateTo);

  const where: Prisma.TicketWhereInput = {
    ...(divisionId ? { divisionId } : {}),
    resolvedAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
  };

  const [total, breached] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, slaBreached: true } }),
  ]);

  const rate = total === 0 ? 0 : (breached / total) * 100;

  return { totalResolved: total, breached, breachRatePercent: Number(rate.toFixed(2)) };
}

export async function getCsat(user: AccessTokenPayload, params: { divisionId?: string; dateFrom?: string; dateTo?: string }) {
  const divisionId = resolveDivisionFilter(user, params.divisionId);
  const { from, to } = resolveDateRange(params.dateFrom, params.dateTo);

  const where: Prisma.TicketRatingWhereInput = {
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(divisionId ? { ticket: { divisionId } } : {}),
  };

  const [aggregate, latest] = await Promise.all([
    prisma.ticketRating.aggregate({
      where,
      _avg: { score: true },
      _count: { _all: true },
    }),
    prisma.ticketRating.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            title: true,
            createdBy: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return {
    averageScore: aggregate._avg.score ? Number(aggregate._avg.score.toFixed(2)) : 0,
    totalRatings: aggregate._count._all,
    latestRatings: latest.map((rating) => ({
      score: rating.score,
      feedback: rating.feedback,
      createdAt: rating.createdAt,
      ticketNumber: rating.ticket.ticketNumber,
      ticketTitle: rating.ticket.title,
      reporterName: rating.ticket.createdBy.name,
    })),
  };
}
