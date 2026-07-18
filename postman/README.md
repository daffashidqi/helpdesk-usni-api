# Postman Collection — helpdesk-usni-api

## Import

1. Buka Postman -> **Import** -> pilih kedua file berikut:
   - `helpdesk-usni-api.postman_collection.json`
   - `helpdesk-usni-api.postman_environment.json`
2. Pilih environment **"helpdesk-usni-api (local)"** di dropdown kanan atas Postman.
3. Pastikan backend sudah jalan (`bun run dev`) dan database sudah di-seed (`bun run prisma:seed`).

## Urutan testing yang disarankan

### 1. Login sebagai Admin
Jalankan **Auth > Login (Admin - seed)** — memakai kredensial dari `prisma/seed.ts` (default `admin@usni.ac.id` / `Admin12345`). Script Tests otomatis menyimpan `accessToken` ke environment.

### 2. Master Data
- **Master Data - Roles > List Roles** dan **Master Data - Divisions > List Divisions** — otomatis menyimpan `pelaporRoleId`, `itRoleId`, `itDivisionId` ke environment untuk dipakai request lain.
- **Categories > List Categories** — otomatis menyimpan `categoryId` (kategori pertama hasil seed).

### 3. Buat Agent & Pelapor
- **User Management > Create User (Agent IT)** — butuh `itRoleId` & `itDivisionId` (dari langkah 2). User baru langsung `emailVerified` (dibuat admin).
- **Auth > Register** untuk membuat akun PELAPOR baru, lalu **Auth > Verify Email** (ambil token dari console log server karena SMTP belum di-set — server mencetak link verifikasi lengkap ke console).

### 4. Alur Tiket Lengkap
Login bergantian sesuai kebutuhan role (accessToken di environment ter-overwrite tiap login):

1. Login sebagai **PELAPOR** -> **Tickets > Create Ticket** (otomatis simpan `ticketId`)
2. Login sebagai **agen IT** (sesuai divisi kategori tiket) -> **Tickets > Assign Ticket to Me**
3. Agen -> **Tickets > Add Comment** (isInternal opsional)
4. Agen -> **Tickets > Update Status -> RESOLVED**
5. Login kembali sebagai **PELAPOR** -> **Tickets > Update Status -> CLOSED**
6. Pelapor -> **Tickets > Add Rating**
7. Pelapor -> **Tickets > Reopen Ticket** (hanya berlaku maks. 3 hari setelah closed)

### 5. FAQ & Notifikasi
- **FAQ > Create FAQ** (role ADMIN/IT/AKADEMIK/BUSP) lalu **Get/Update/Delete FAQ**.
- **Notifications > List Notifications** — otomatis simpan `notificationId` notifikasi pertama untuk **Mark One as Read**.

### 6. Dashboard
Login sebagai ADMIN atau agen, lalu jalankan **Dashboard > Summary / MTTR / SLA Breach Rate / CSAT**.

## Catatan

- Refresh token dikirim server sebagai cookie **httpOnly** — aktifkan cookie jar Postman (default aktif) supaya `Auth > Refresh Token` dan `Auth > Logout` bisa membaca cookie tersebut.
- `POST /tickets` dan `POST /users/bulk-upload` pakai `multipart/form-data` — di Postman pilih tab **Body > form-data**, field file (`attachments` / `file`) bisa dikosongkan jika tidak ingin upload lampiran.
- Endpoint yang butuh role tertentu akan mengembalikan `403` jika `accessToken` di environment bukan milik role yang sesuai — pastikan login ulang dengan user yang tepat sebelum memanggilnya.
- Kalau testing di production/staging (`NODE_ENV=production`), cookie diberi flag `Secure` sehingga hanya terkirim lewat HTTPS.
