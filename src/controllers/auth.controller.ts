import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailQuerySchema,
} from "../validations/auth.validation";
import {
  getUserById,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "../services/auth.service";
import { handleError } from "../lib/errors";
import { REFRESH_TOKEN_MAX_AGE_SECONDS } from "../lib/jwt";

const REFRESH_COOKIE_NAME = "refreshToken";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "Strict",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

function clearRefreshCookie(c: Context) {
  deleteCookie(c, REFRESH_COOKIE_NAME, { path: "/" });
}

export async function registerController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    await registerUser(parsed.data);
    return c.json(
      { message: "Registrasi berhasil. Silakan cek email untuk verifikasi akun." },
      201
    );
  } catch (err) {
    return handleError(c, err);
  }
}

export async function verifyEmailController(c: Context) {
  const parsed = verifyEmailQuerySchema.safeParse({ token: c.req.query("token") });
  if (!parsed.success) {
    return c.json({ message: "Token tidak valid" }, 400);
  }

  try {
    await verifyEmail(parsed.data.token);
    return c.json({ message: "Email berhasil diverifikasi. Silakan login." }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function loginController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    const { accessToken, refreshToken, user } = await loginUser(parsed.data);
    setRefreshCookie(c, refreshToken);
    return c.json({ accessToken, user }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function refreshController(c: Context) {
  const refreshToken = getCookie(c, REFRESH_COOKIE_NAME);
  if (!refreshToken) {
    return c.json({ message: "Refresh token tidak ditemukan" }, 401);
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await refreshSession(refreshToken);
    setRefreshCookie(c, newRefreshToken);
    return c.json({ accessToken }, 200);
  } catch (err) {
    clearRefreshCookie(c);
    return handleError(c, err);
  }
}

export async function logoutController(c: Context) {
  const user = c.get("user");
  if (user?.userId) {
    await logoutUser(user.userId);
  }
  clearRefreshCookie(c);
  return c.json({ message: "Logout berhasil" }, 200);
}

export async function forgotPasswordController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  await requestPasswordReset(parsed.data.email);

  return c.json(
    { message: "Jika email terdaftar, tautan reset password telah dikirim." },
    200
  );
}

export async function resetPasswordController(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, 400);
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.newPassword);
    return c.json({ message: "Password berhasil direset. Silakan login kembali." }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function meController(c: Context) {
  const payload = c.get("user");
  const user = await getUserById(payload.userId);
  if (!user) {
    return c.json({ message: "User tidak ditemukan" }, 404);
  }
  return c.json({ user }, 200);
}
