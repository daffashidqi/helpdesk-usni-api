import path from "node:path";
import crypto from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

const SETTINGS_ID = "singleton";
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? "./uploads";
}

function sanitizeExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

export async function getSettings() {
  const settings = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  return { logoPath: settings?.logoPath ?? null, faviconPath: settings?.faviconPath ?? null };
}

/**
 * Mengubah logo situs SEKALIGUS favicon-nya, memakai file yang sama —
 * "ubah logo" dan "ubah favicon" bukan dua aksi terpisah dari sudut pandang
 * Admin, jadi satu upload cukup untuk memperbarui keduanya. File lama (baik
 * logo maupun favicon) dihapus supaya folder branding tidak menumpuk.
 */
export async function updateLogo(file: File) {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new AppError(`Tipe file "${file.type || "tidak diketahui"}" tidak diizinkan. Hanya PNG, JPG, SVG, WEBP.`, 400);
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new AppError(`Ukuran file melebihi batas maksimal ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB`, 400);
  }

  const existing = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });

  const ext = sanitizeExtension(file.name) || ".png";
  const relativeDir = "branding";
  const fileName = `logo-${crypto.randomUUID()}${ext}`;
  const relativePath = path.join(relativeDir, fileName).split(path.sep).join("/");
  const absoluteDir = path.join(getUploadDir(), relativeDir);
  const absolutePath = path.join(absoluteDir, fileName);

  await mkdir(absoluteDir, { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(absolutePath, arrayBuffer);

  const updated = await prisma.systemSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { logoPath: relativePath, faviconPath: relativePath },
    create: { id: SETTINGS_ID, logoPath: relativePath, faviconPath: relativePath },
  });

  // Hapus file logo/favicon lama (kalau ada dan berbeda dari file baru).
  const oldPaths = new Set([existing?.logoPath, existing?.faviconPath].filter(Boolean) as string[]);
  for (const oldPath of oldPaths) {
    if (oldPath !== relativePath) {
      await rm(path.join(getUploadDir(), oldPath), { force: true }).catch(() => {});
    }
  }

  return { logoPath: updated.logoPath, faviconPath: updated.faviconPath };
}

export async function resetLogo() {
  const existing = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  await prisma.systemSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { logoPath: null, faviconPath: null },
    create: { id: SETTINGS_ID, logoPath: null, faviconPath: null },
  });

  const oldPaths = new Set([existing?.logoPath, existing?.faviconPath].filter(Boolean) as string[]);
  for (const oldPath of oldPaths) {
    await rm(path.join(getUploadDir(), oldPath), { force: true }).catch(() => {});
  }

  return { logoPath: null, faviconPath: null };
}
