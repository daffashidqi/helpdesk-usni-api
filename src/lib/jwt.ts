import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET belum di-set");
  return new TextEncoder().encode(secret);
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET belum di-set");
  return new TextEncoder().encode(secret);
}

/**
 * `role` disimpan sebagai Role.code (string), bukan roleId, supaya middleware
 * roleGuard bisa cek akses tanpa query database di setiap request. Konsekuensinya:
 * jika Admin mengubah role/divisi seorang user, perubahan itu baru berlaku setelah
 * access token lama expire (maksimal 15 menit) atau user login ulang.
 */
export interface AccessTokenPayload {
  userId: string;
  role: string;
  divisionId: string | null;
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getAccessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret());
  return payload as unknown as AccessTokenPayload;
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getRefreshSecret());
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecret());
  return payload as unknown as RefreshTokenPayload;
}

export const isJwtExpiredError = (err: unknown) =>
  err instanceof joseErrors.JWTExpired || err instanceof joseErrors.JWTInvalid;

export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
