import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { AccessTokenPayload } from "../lib/jwt";
import type { CreateFaqInput, ListFaqQuery, UpdateFaqInput } from "../validations/faq.validation";

export async function listFaq(user: AccessTokenPayload, query: ListFaqQuery) {
  const where: Prisma.FaqArticleWhereInput = {
    ...(query.divisionId ? { divisionId: query.divisionId } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { content: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(user.role === "PELAPOR" ? { isPublished: true } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.faqArticle.findMany({
      where,
      include: { division: true, author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.faqArticle.count({ where }),
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

export async function getFaqById(user: AccessTokenPayload, id: string) {
  const article = await prisma.faqArticle.findUnique({
    where: { id },
    include: { division: true, author: { select: { id: true, name: true } } },
  });
  if (!article) {
    throw new AppError("Artikel FAQ tidak ditemukan", 404);
  }
  if (!article.isPublished && user.role === "PELAPOR") {
    throw new AppError("Artikel FAQ tidak ditemukan", 404);
  }

  await prisma.faqArticle.update({ where: { id }, data: { viewCount: { increment: 1 } } });

  return article;
}

export async function createFaq(user: AccessTokenPayload, input: CreateFaqInput) {
  if (input.divisionId) {
    const division = await prisma.division.findUnique({ where: { id: input.divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  return prisma.faqArticle.create({
    data: {
      title: input.title,
      content: input.content,
      divisionId: input.divisionId ?? null,
      isPublished: input.isPublished,
      authorId: user.userId,
    },
    include: { division: true, author: { select: { id: true, name: true } } },
  });
}

export async function updateFaq(user: AccessTokenPayload, id: string, input: UpdateFaqInput) {
  const article = await prisma.faqArticle.findUnique({ where: { id } });
  if (!article) {
    throw new AppError("Artikel FAQ tidak ditemukan", 404);
  }
  if (article.authorId !== user.userId && user.role !== "ADMIN") {
    throw new AppError("Hanya author atau ADMIN yang bisa mengubah artikel ini", 403);
  }

  if (input.divisionId) {
    const division = await prisma.division.findUnique({ where: { id: input.divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  return prisma.faqArticle.update({
    where: { id },
    data: {
      title: input.title,
      content: input.content,
      divisionId: input.divisionId,
      isPublished: input.isPublished,
    },
    include: { division: true, author: { select: { id: true, name: true } } },
  });
}

export async function deleteFaq(user: AccessTokenPayload, id: string) {
  const article = await prisma.faqArticle.findUnique({ where: { id } });
  if (!article) {
    throw new AppError("Artikel FAQ tidak ditemukan", 404);
  }
  if (article.authorId !== user.userId && user.role !== "ADMIN") {
    throw new AppError("Hanya author atau ADMIN yang bisa menghapus artikel ini", 403);
  }

  await prisma.faqArticle.delete({ where: { id } });
}
