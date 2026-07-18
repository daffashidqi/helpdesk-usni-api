import { AppError } from "./errors";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/**
 * Verifikasi token reCAPTCHA v2 ke Google. Jika RECAPTCHA_SECRET_KEY tidak
 * di-set (mis. dev lokal tanpa koneksi keluar), verifikasi dilewati supaya
 * tidak memblokir alur registrasi.
 */
export async function verifyRecaptcha(token: string | undefined) {
  // Captcha dimatikan di development supaya alur testing/registrasi tidak terblokir.
  if ((process.env.NODE_ENV ?? "development") !== "production") return;

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return;

  if (!token) {
    throw new AppError("Verifikasi captcha wajib diisi", 400);
  }

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  }).catch(() => null);

  if (!res || !res.ok) {
    throw new AppError("Gagal memverifikasi captcha, coba lagi", 502);
  }

  const data = (await res.json()) as { success: boolean };
  if (!data.success) {
    throw new AppError("Verifikasi captcha gagal, coba lagi", 400);
  }
}
