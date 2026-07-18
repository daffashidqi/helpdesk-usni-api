# helpdesk-usni-api

Backend API **Sistem Helpdesk Ticketing USNI** — autentikasi, master data role/divisi/kategori, ticketing engine, knowledge base/FAQ, notifikasi, dan dashboard analytics. Berjalan sebagai service standalone yang dikonsumsi oleh frontend Next.js melalui REST API (cross-origin).

## Stack

- **Runtime:** Bun
- **Framework:** Hono
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Password hashing:** bcryptjs
- **JWT:** jose
- **Email:** nodemailer (SMTP kampus)
- **Validasi:** Zod
- **Rate limiting:** hono-rate-limiter (in-memory)
- **File upload:** local disk (`/uploads`), struktur path relatif memudahkan migrasi ke S3/MinIO nanti

## Struktur Project

```
src/
  index.ts
  routes/          -> auth, role, division, user, profile, ticket, category, faq, notification, dashboard
  controllers/      -> handler tiap endpoint
  services/         -> business logic (termasuk email, notification, upload)
  middlewares/       -> auth.middleware (authMiddleware, roleGuard, hasDivisionAccess), rateLimit.middleware
  lib/                -> prisma client, jwt helper, ticketNumber generator, AppError
  validations/         -> Zod schema per modul
prisma/
  schema.prisma          -> skema lengkap database
  seed.ts                 -> seed idempotent (role, divisi, admin, kategori)
uploads/                   -> penyimpanan lampiran tiket
```

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Salin `.env.example` menjadi `.env` dan isi sesuai environment kamu.

3. Sinkronkan skema ke database (development):

   ```bash
   bun x prisma db push
   ```

   Atau pakai migration history (butuh terminal interaktif):

   ```bash
   bun run prisma:migrate
   ```

4. Jalankan seed (role, divisi, admin default, kategori tiket):

   ```bash
   bun run prisma:seed
   ```

   Login admin default: lihat `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` di `.env` (fallback `admin@usni.ac.id` / `Admin12345`). **Segera ganti password ini setelah login pertama.**

5. Jalankan server dalam mode development:

   ```bash
   bun run dev
   ```

Server berjalan di `http://localhost:4000` (atau sesuai `PORT` di `.env`).

## Dokumentasi & Testing

- Dokumentasi lengkap tiap endpoint: [`docs/API.md`](docs/API.md)
- Koleksi Postman siap import (+ environment): [`postman/`](postman/)

## Modul & Endpoint

| Modul | Endpoint utama | Akses |
|---|---|---|
| Autentikasi | `/auth/*` | Publik (kecuali `/auth/me`, `/auth/logout`) |
| Role (master data) | `GET /roles`, `POST/PATCH/DELETE /roles/:id` | Login wajib; tulis khusus ADMIN |
| Division (master data) | `GET /divisions`, `POST/PATCH/DELETE /divisions/:id` | Login wajib; tulis khusus ADMIN |
| User Management | `/users/*` | Khusus ADMIN |
| Profil | `/profile`, `/profile/password` | Semua role login |
| Kategori Tiket | `/categories/*` | Login wajib; tulis khusus ADMIN |
| Ticketing Engine | `/tickets/*` | Semua role login (filter otomatis by role/divisi) |
| Knowledge Base/FAQ | `/faq/*` | Login wajib |
| Notifikasi | `/notifications/*` | Semua role login |
| Dashboard & Analytics | `/dashboard/*` | ADMIN & agen (IT/AKADEMIK/BUSP) |

Detail request/response tiap endpoint ada di [`docs/API.md`](docs/API.md).

## Master Data Role & Division — Catatan Penting

`Role` dan `Division` adalah tabel master data (bukan enum) supaya Admin bisa menambah role/divisi baru **tanpa deploy ulang**. Namun perlu dipahami batasannya:

- Payload JWT (access token) menyimpan `role` sebagai **Role.code** (string) hasil snapshot saat login/refresh — bukan `roleId` — supaya `roleGuard` bisa memvalidasi tanpa query database di setiap request. Konsekuensinya: perubahan role/divisi seorang user oleh Admin baru berlaku penuh setelah access token lama expire (maksimal 15 menit) atau user login ulang.
- 5 role bawaan (`ADMIN`, `IT`, `AKADEMIK`, `BUSP`, `PELAPOR`) dan 3 divisi bawaan (`IT`, `AKADEMIK`, `BUSP`) ditandai `isSystem = true` — code-nya tidak bisa diubah dan record-nya tidak bisa dihapus.
- Role/divisi baru yang dibuat Admin **tidak otomatis mendapat middleware guard** untuk fitur ticketing yang sudah ada (assign, ubah status, dashboard, dll) — fitur-fitur tersebut secara eksplisit mengecek code `ADMIN`/`IT`/`AKADEMIK`/`BUSP`/`PELAPOR`. Role tambahan (mis. "KEUANGAN") saat ini hanya berperilaku seperti `PELAPOR` di ticketing engine kecuali ada pengembangan lanjutan untuk menghubungkannya.

## Ticketing Engine — State Machine Status

```
OPEN --(assign oleh agen divisi terkait)--> IN_PROGRESS
IN_PROGRESS <--> PENDING                          (agen)
IN_PROGRESS/PENDING --(agen)--> RESOLVED
RESOLVED --(konfirmasi pemilik tiket/pelapor)--> CLOSED
CLOSED --(reopen oleh pelapor, maks. 3 hari setelah closed)--> REOPENED
REOPENED <--> IN_PROGRESS/PENDING/RESOLVED         (agen, alur sama seperti di atas)
```

Setiap perubahan (assign, reassign, status, reopen, komentar) tercatat di `TicketHistory` untuk audit trail.

## Keamanan

- Access token (JWT, 15 menit) dikirim di body response, disimpan di memory/state frontend (bukan localStorage).
- Refresh token (JWT, 7 hari) disimpan sebagai cookie `httpOnly`, `secure`, `sameSite=strict`, hash-nya disimpan di kolom `refreshTokenHash`.
- Semua endpoint kecuali `auth/register`, `auth/login`, `auth/verify-email`, `auth/forgot-password`, `auth/reset-password` wajib `authMiddleware`.
- `passwordHash` dan `refreshTokenHash` tidak pernah dikembalikan di response manapun.
- Validasi kepemilikan/akses data di endpoint tiket: PELAPOR hanya akses tiket miliknya, agen hanya akses tiket divisinya (`hasDivisionAccess` di `middlewares/auth.middleware.ts`), ADMIN bebas.
- Upload lampiran divalidasi mime type (`jpg`, `png`, `pdf`, `docx`) dan ukuran maksimal (`MAX_FILE_SIZE_MB`).
- Endpoint sensitif (`register`, `login`, `forgot-password`) dibatasi rate limit 10 request/menit per IP.

## Catatan Rate Limiting

In-memory store (`hono-rate-limiter`), cocok untuk deployment single-instance ~150 user. Jika nanti multi-instance/replica, upgrade ke Redis store (`ioredis` / `@upstash/redis`).
