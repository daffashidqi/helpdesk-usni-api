import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { AccessTokenPayload } from "../lib/jwt";
import type { CreateFaqInput, ListFaqQuery, PublicFaqQuery, UpdateFaqInput } from "../validations/faq.validation";

export const MAX_HOMEPAGE_FAQ = 5;

async function countHomepageFaq(excludeId?: string) {
  return prisma.faqArticle.count({
    where: { showOnHomepage: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

async function assertHomepageQuota(excludeId?: string) {
  const current = await countHomepageFaq(excludeId);
  if (current >= MAX_HOMEPAGE_FAQ) {
    throw new AppError(
      `Maksimal ${MAX_HOMEPAGE_FAQ} artikel FAQ yang bisa tampil di homepage. Nonaktifkan salah satu dulu sebelum menambah yang baru.`,
      400
    );
  }
}

/**
 * Dipakai homepage publik (sebelum login) — hanya artikel isPublished DAN
 * showOnHomepage (dikurasi manual, maksimal MAX_HOMEPAGE_FAQ), tanpa perlu
 * autentikasi. Sengaja terpisah dari listFaq supaya jalur autentikasi FAQ
 * dashboard tidak perlu disentuh/dilonggarkan.
 */
export async function listPublicFaq(query: PublicFaqQuery) {
  const where: Prisma.FaqArticleWhereInput = {
    isPublished: true,
    // Tanpa kata kunci: hanya tampilkan 5 artikel yang dikurasi manual
    // (showOnHomepage). Saat user mencari, cakupannya dilebarkan ke SEMUA
    // artikel published — supaya solusi tetap ketemu meski artikelnya
    // sedang tidak "ditampilkan" di homepage.
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { content: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : { showOnHomepage: true }),
  };

  return prisma.faqArticle.findMany({
    where,
    select: { id: true, title: true, content: true },
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });
}

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

  const [items, total, homepageCount] = await Promise.all([
    prisma.faqArticle.findMany({
      where,
      include: { division: true, author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.faqArticle.count({ where }),
    countHomepageFaq(),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
    homepageCount,
    maxHomepageFaq: MAX_HOMEPAGE_FAQ,
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
  // Agen (bukan ADMIN) tidak bisa memilih divisi manual — artikel yang mereka
  // buat otomatis terikat ke divisi mereka sendiri. ADMIN tetap bebas memilih
  // (termasuk null untuk artikel General lintas divisi).
  const divisionId = user.role === "ADMIN" ? (input.divisionId ?? null) : user.divisionId;

  if (divisionId) {
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  if (input.showOnHomepage) {
    await assertHomepageQuota();
  }

  return prisma.faqArticle.create({
    data: {
      title: input.title,
      content: input.content,
      divisionId,
      isPublished: input.isPublished,
      showOnHomepage: input.showOnHomepage,
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

  // Sama seperti createFaq: agen tidak bisa memindahkan artikel ke divisi lain.
  const divisionId = user.role === "ADMIN" ? input.divisionId : undefined;

  if (divisionId) {
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  if (input.showOnHomepage && !article.showOnHomepage) {
    await assertHomepageQuota(id);
  }

  return prisma.faqArticle.update({
    where: { id },
    data: {
      title: input.title,
      content: input.content,
      divisionId,
      isPublished: input.isPublished,
      showOnHomepage: input.showOnHomepage,
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
