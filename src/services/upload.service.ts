import path from "node:path";
import crypto from "node:crypto";
import { mkdir } from "node:fs/promises";
import { AppError } from "../lib/errors";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

function getUploadDir() {
  return process.env.UPLOAD_DIR ?? "./uploads";
}

function getMaxFileSizeBytes() {
  const mb = Number(process.env.MAX_FILE_SIZE_MB ?? 5);
  return mb * 1024 * 1024;
}

function sanitizeExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

export interface SavedAttachment {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Validasi & simpan satu file lampiran ke local disk (folder UPLOAD_DIR,
 * per-ticket subfolder). Struktur disengaja sederhana (path relatif tersimpan
 * di kolom TicketAttachment.filePath) supaya gampang dipindah ke object
 * storage (S3/MinIO) nanti — cukup ganti implementasi fungsi ini, kolom
 * database tidak perlu berubah.
 */
export async function saveTicketAttachment(
  ticketId: string,
  file: File
): Promise<SavedAttachment> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError(
      `Tipe file "${file.type || "tidak diketahui"}" tidak diizinkan. Hanya JPG, PNG, PDF, DOCX.`,
      400
    );
  }

  const maxSize = getMaxFileSizeBytes();
  if (file.size > maxSize) {
    throw new AppError(`Ukuran file melebihi batas maksimal ${maxSize / (1024 * 1024)}MB`, 400);
  }

  const ext = sanitizeExtension(file.name);
  const safeName = `${crypto.randomUUID()}${ext}`;
  const relativeDir = path.join("tickets", ticketId);
  const relativePath = path.join(relativeDir, safeName);
  const absoluteDir = path.join(getUploadDir(), relativeDir);
  const absolutePath = path.join(absoluteDir, safeName);

  await mkdir(absoluteDir, { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(absolutePath, arrayBuffer);

  return {
    fileName: file.name,
    filePath: relativePath.split(path.sep).join("/"),
    fileSize: file.size,
    mimeType: file.type,
  };
}
