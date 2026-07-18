# API Documentation — helpdesk-usni-api

Dokumentasi lengkap seluruh modul backend Sistem Helpdesk Ticketing USNI.

- **Base URL (development):** `http://localhost:4000`
- **Format:** JSON (`Content-Type: application/json`), kecuali `POST /tickets` dan `POST /users/bulk-upload` yang pakai `multipart/form-data`
- **Auth scheme:** `Authorization: Bearer <accessToken>` untuk semua endpoint protected
- **Cookie:** `refreshToken` (httpOnly, secure di production, sameSite=strict) — diset otomatis oleh server saat login

Lihat juga koleksi Postman siap pakai di [`postman/`](../postman/).

Semua endpoint **kecuali** `POST /auth/register`, `POST /auth/login`, `GET /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password` wajib header `Authorization: Bearer <accessToken>`.

---

## Daftar Isi

1. [Autentikasi](#1-autentikasi)
2. [Master Data: Role & Division](#2-master-data-role--division)
3. [Manajemen User](#3-manajemen-user-khusus-admin)
4. [Profil](#4-profil-semua-role)
5. [Master Data Kategori Tiket](#5-master-data-kategori-tiket-khusus-admin-untuk-tulis)
6. [Ticketing Engine](#6-ticketing-engine)
7. [Knowledge Base / FAQ](#7-knowledge-base--faq)
8. [Notifikasi](#8-notifikasi)
9. [Dashboard & Analytics](#9-dashboard--analytics)

---

## 1. Autentikasi

| Method | Endpoint | Auth | Rate Limit |
|---|---|---|---|
| POST | `/auth/register` | ❌ | ✅ 10/menit/IP |
| GET | `/auth/verify-email?token=` | ❌ | ❌ |
| POST | `/auth/login` | ❌ | ✅ 10/menit/IP |
| POST | `/auth/refresh` | Cookie | ❌ |
| POST | `/auth/logout` | Bearer | ❌ |
| POST | `/auth/forgot-password` | ❌ | ✅ 10/menit/IP |
| POST | `/auth/reset-password` | ❌ | ❌ |
| GET | `/auth/me` | Bearer | ❌ |

**Register** — `{ name, email, password }`. Email harus `@usni.ac.id`/`@student.usni.ac.id`, password min 8 karakter. User dibuat dengan role `PELAPOR`, `emailVerified = null`, email verifikasi dikirim (berlaku 24 jam).

**Login** — `{ email, password }`. Syarat: `isActive = true`, `emailVerified` terisi, password cocok. Response: `{ accessToken, user: { id, name, email, role, division } }` + cookie `refreshToken`.

**Refresh** — baca cookie `refreshToken`, terbitkan access token baru + rotasi refresh token.

**Logout** — hapus cookie & `refreshTokenHash` di DB.

**Forgot/Reset Password** — response `forgot-password` selalu sama (cegah user enumeration). `reset-password`: `{ token, newPassword }`, invalidate semua refresh token aktif setelah sukses.

**Me** — `{ user: { id, name, email, role, division, isActive } }`.

> **Catatan role/JWT**: payload access token menyimpan `role` sebagai **Role.code** (string, snapshot saat login) beserta `divisionId`, bukan `roleId`. Perubahan role/divisi oleh Admin baru berlaku penuh setelah access token lama expire (maks. 15 menit) atau user login ulang.

---

## 2. Master Data: Role & Division

Role dan Division adalah tabel master data (bukan enum) — Admin bisa menambah baru tanpa deploy ulang. `GET` bisa diakses semua role yang login (dipakai untuk dropdown); `POST`/`PATCH`/`DELETE` khusus `ADMIN`.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/roles` | List semua role |
| POST | `/roles` | `{ code, name }` — code otomatis di-uppercase |
| PATCH | `/roles/:id` | `{ code?, name? }` |
| DELETE | `/roles/:id` | Tolak jika `isSystem=true` atau masih dipakai user |
| GET | `/divisions` | List semua divisi |
| POST | `/divisions` | `{ code, name }` |
| PATCH | `/divisions/:id` | `{ code?, name? }` |
| DELETE | `/divisions/:id` | Tolak jika `isSystem=true` atau masih dipakai user/kategori/tiket |

**Aturan `isSystem`**: 5 role bawaan (`ADMIN`, `IT`, `AKADEMIK`, `BUSP`, `PELAPOR`) dan 3 divisi bawaan (`IT`, `AKADEMIK`, `BUSP`) punya `isSystem=true` — code tidak bisa diubah, record tidak bisa dihapus. Errors: `403` jika melanggar `isSystem`, `409` jika code duplikat atau masih dipakai (pesan menyebutkan jumlah user yang memakai).

**Batasan penting**: role/divisi baru yang dibuat Admin **tidak otomatis** mendapat akses ke fitur ticketing (assign, ubah status, dashboard, dll) karena fitur tersebut mengecek code spesifik (`IT`/`AKADEMIK`/`BUSP`/`ADMIN`/`PELAPOR`) di `roleGuard`. Role tambahan hanya berperilaku seperti `PELAPOR` di ticketing engine kecuali ada pengembangan lanjutan.

---

## 3. Manajemen User (khusus ADMIN)

Semua endpoint di bawah wajib role `ADMIN`.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/users` | Query: `page, limit, search, roleId, divisionId, isActive` |
| POST | `/users` | `{ name, email, roleId, divisionId?, password? }` |
| PATCH | `/users/:id` | `{ name?, email?, roleId?, divisionId?, isActive? }` |
| DELETE | `/users/:id` | Soft delete (`isActive=false`, bukan hard delete) |
| POST | `/users/bulk-upload` | `multipart/form-data`, field `file` (CSV) |

**Create User** — jika `password` tidak diisi, sistem generate token acak dan kirim email "set password pertama kali" (mekanisme sama seperti reset password, berlaku 1 jam). `emailVerified` langsung terisi (dibuat Admin, tidak perlu verifikasi manual). `divisionId` **wajib** jika `roleId` merujuk ke role `IT`/`AKADEMIK`/`BUSP` (divalidasi di service layer berdasarkan `Role.code`, bukan hardcode roleId).

**Update User** — tidak bisa update password lewat endpoint ini (pisahkan concern, lihat [Profil](#4-profil-semua-role) atau alur reset password).

**Bulk Upload** — CSV wajib kolom header `name,email,roleCode` (roleCode merujuk ke `Role.code`, human-readable). Untuk role yang butuh divisi (`IT`/`AKADEMIK`/`BUSP`), `divisionId` otomatis diambil dari `Division` yang code-nya sama persis dengan role code (konvensi bawaan seed) — baris ditolak jika division dengan code tsb tidak ada. Response:

```json
{
  "total": 10,
  "success": 8,
  "failed": 2,
  "results": [
    { "row": 2, "email": "a@student.usni.ac.id", "success": true },
    { "row": 3, "email": "bad-email", "success": false, "reason": "Email harus domain @usni.ac.id atau @student.usni.ac.id" }
  ]
}
```

---

## 4. Profil (semua role)

| Method | Endpoint | Keterangan |
|---|---|---|
| PATCH | `/profile` | `{ name?, email? }` |
| PATCH | `/profile/password` | `{ currentPassword, newPassword }` |

Jika `email` diubah: validasi domain & unique, `emailVerified` di-reset ke `null`, email verifikasi baru dikirim otomatis. Update password memvalidasi `currentPassword` terlebih dahulu dan meng-invalidate refresh token aktif (user harus login ulang di semua device).

---

## 5. Master Data Kategori Tiket (khusus ADMIN untuk tulis)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/categories` | Semua role login, include data `division` |
| POST | `/categories` | ADMIN, `{ name, divisionId, slaHours }` |
| PATCH | `/categories/:id` | ADMIN, `{ name?, divisionId?, slaHours?, isActive? }` |
| DELETE | `/categories/:id` | ADMIN, soft delete (`isActive=false`) |

`slaHours` dipakai untuk menghitung `slaDeadline` tiket (`createdAt + slaHours`).

---

## 6. Ticketing Engine

Inti aplikasi. Semua endpoint butuh login; filter akses otomatis berdasarkan role.

| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| POST | `/tickets` | Semua role | `multipart/form-data` |
| GET | `/tickets` | Semua role | List (filter otomatis by role) |
| GET | `/tickets/:id` | Sesuai kepemilikan/divisi | Detail lengkap |
| PATCH | `/tickets/:id/assign` | `IT`,`AKADEMIK`,`BUSP` | "Assign to me" |
| PATCH | `/tickets/:id/reassign-division` | `IT`,`AKADEMIK`,`BUSP`,`ADMIN` | Pindah kategori/divisi |
| PATCH | `/tickets/:id/status` | Lihat state machine | Update status |
| PATCH | `/tickets/:id/reopen` | Pemilik tiket | Buka kembali tiket CLOSED |
| POST | `/tickets/:id/comments` | Sesuai akses tiket | Tambah komentar |
| POST | `/tickets/:id/rating` | Pemilik tiket | Rating (hanya saat CLOSED) |

### Create Ticket

`multipart/form-data`:

| Field | Tipe | Wajib |
|---|---|---|
| `title` | string (3-200 char) | ✅ |
| `description` | string (min 10 char) | ✅ |
| `categoryId` | string | ✅ |
| `urgency` | `LOW`\|`NORMAL`\|`HIGH`\|`CRITICAL` | opsional (default `NORMAL`) |
| `attachments` | file(s), max `MAX_FILE_SIZE_MB` per file | opsional |

Tipe file yang diterima: JPG, PNG, PDF, DOCX. Logic: `divisionId` di-copy dari `category.divisionId` (routing otomatis), `ticketNumber` di-generate format `TIX-2026-00001` (unik, increment per tahun), `slaDeadline = now() + category.slaHours`. Semua agen aktif di divisi terkait dapat notifikasi in-app + email "Ada tiket baru masuk ke pool kamu".

### List & Filter Akses

Query: `status, divisionId, categoryId, urgency, assignedToId, search, page, limit`.

- **PELAPOR**: hanya tiket yang dia buat (`createdById = user.userId`)
- **IT/AKADEMIK/BUSP**: hanya tiket di divisinya sendiri (`divisionId = user.divisionId`), termasuk yang masih di pool (belum di-assign)
- **ADMIN**: semua tiket, tanpa filter tambahan

### Detail Tiket

Termasuk `comments` (komentar `isInternal` disembunyikan dari PELAPOR), `histories`, `attachments`, `rating`. Error `403` jika tidak punya akses (PELAPOR bukan pemilik, agen beda divisi).

### Assign ("assign to me")

Hanya bisa jika tiket berstatus `OPEN` dan `ticket.divisionId === user.divisionId`. Set `assignedToId = user`, status → `IN_PROGRESS`. Notifikasi ke pelapor.

### Reassign Division

`{ newCategoryId }`. Untuk misrouting/salah kategori. Reset `assignedToId = null`, status → `OPEN`, `divisionId` diambil dari `newCategory.divisionId`. Notifikasi ke agen divisi baru.

### Update Status — State Machine

```
OPEN --(assign)--> IN_PROGRESS
IN_PROGRESS <--> PENDING                    [agen divisi terkait]
IN_PROGRESS/PENDING --> RESOLVED             [agen divisi terkait]
RESOLVED --> CLOSED                          [HANYA pemilik/pelapor tiket, konfirmasi]
CLOSED --(reopen, endpoint terpisah)--> REOPENED
REOPENED <--> IN_PROGRESS/PENDING/RESOLVED   [agen, sama seperti alur normal]
```

- Transisi ke `PENDING`/`IN_PROGRESS`/`RESOLVED`: wajib role agen (`IT`/`AKADEMIK`/`BUSP`) **dan** `ticket.divisionId === user.divisionId`. Error `403`/`400` jika melanggar state machine (`Tidak bisa mengubah status dari X ke Y`).
- Transisi ke `CLOSED`: **hanya** `ticket.createdById === user.userId`, dan status sebelumnya harus `RESOLVED`.
- Saat → `RESOLVED`: `resolvedAt = now()`, `slaBreached = resolvedAt > slaDeadline`.
- Saat → `CLOSED`: `closedAt = now()`.
- Setiap transisi tercatat di `TicketHistory` (`action: "STATUS_CHANGED"`) dan memicu notifikasi ke pelapor & agen terkait.

### Reopen

Hanya pemilik tiket (`createdById`), hanya jika status `CLOSED`, dan **maksimal 3 hari** setelah `closedAt` (konstanta `REOPEN_WINDOW_DAYS` di `ticket.service.ts`, mudah diubah). Status → `REOPENED`, `assignedToId` tetap ke agen sebelumnya (konteks tidak hilang).

### Comment

`{ content, isInternal? }`. `isInternal=true` hanya efektif untuk role `ADMIN`/`IT`/`AKADEMIK`/`BUSP` (dipaksa `false` untuk role lain). Komentar internal tidak memicu notifikasi ke pelapor dan tidak muncul di response detail tiket untuk role `PELAPOR`.

### Rating

`{ score: 1-5, feedback? }`. Hanya pemilik tiket, hanya saat status `CLOSED`, hanya sekali (`409` jika sudah pernah rating).

---

## 7. Knowledge Base / FAQ

| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/faq` | Semua role login | Query: `search, divisionId, page, limit` |
| GET | `/faq/:id` | Semua role login | Increment `viewCount` tiap akses |
| POST | `/faq` | `ADMIN`,`IT`,`AKADEMIK`,`BUSP` | `{ title, content, divisionId?, isPublished? }` |
| PATCH | `/faq/:id` | Author atau `ADMIN` | |
| DELETE | `/faq/:id` | Author atau `ADMIN` | |

`divisionId = null` berarti artikel general (semua divisi). Role `PELAPOR` hanya melihat `isPublished=true`; role lain (agen/admin) bisa lihat draft juga.

---

## 8. Notifikasi

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/notifications` | Query: `page, limit, isRead` — milik user login, urut terbaru |
| PATCH | `/notifications/:id/read` | Tandai satu notifikasi sudah dibaca |
| PATCH | `/notifications/read-all` | Tandai semua notifikasi user ini sudah dibaca |

Notifikasi dibuat otomatis oleh ticketing engine (assign, status berubah, komentar baru, dll) via `notification.service.ts` — insert record in-app **dan** kirim email (fire-and-forget, kegagalan kirim email tidak menggagalkan request utama).

---

## 9. Dashboard & Analytics

Khusus role `ADMIN` dan agen (`IT`/`AKADEMIK`/`BUSP`). Query umum: `divisionId` (khusus ADMIN, opsional filter; agen otomatis dibatasi ke divisinya sendiri), `dateFrom`, `dateTo` (ISO date string).

| Method | Endpoint | Isi Response |
|---|---|---|
| GET | `/dashboard/summary` | `total`, `byStatus[]`, `byDivision[]` (khusus ADMIN), `createdToday/ThisWeek/ThisMonth` |
| GET | `/dashboard/mttr` | `mttrHours` (rata-rata `resolvedAt - createdAt`), `sampleSize` |
| GET | `/dashboard/sla-breach-rate` | `totalResolved`, `breached`, `breachRatePercent` |
| GET | `/dashboard/csat` | `averageScore`, `totalRatings` (dari `TicketRating`) |

Semua query pakai `Prisma.groupBy`/`aggregate` langsung di database (bukan fetch-then-compute) untuk efisiensi.

---

## Error Format Umum

```json
{ "message": "Penjelasan error dalam Bahasa Indonesia" }
```

Error validasi Zod menambahkan field `errors`:

```json
{
  "message": "Data tidak valid",
  "errors": { "fieldErrors": { "email": ["..."] }, "formErrors": [] }
}
```

| Status | Arti umum |
|---|---|
| 400 | Validasi gagal / state machine dilanggar |
| 401 | Token tidak ada/tidak valid/kedaluwarsa |
| 403 | Role/kepemilikan/divisi tidak sesuai |
| 404 | Resource tidak ditemukan |
| 409 | Konflik (duplikat, masih dipakai, sudah pernah rating, dll) |
| 429 | Rate limit terlampaui (`register`, `login`, `forgot-password`) |
| 500 | Error tak terduga di server |
