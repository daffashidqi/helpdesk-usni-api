import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

// SMTP belum di-setup (mis. saat development) tidak boleh menggagalkan alur
// utama (register, login, notifikasi tiket, dll). Jika SMTP belum dikonfigurasi,
// atau pengiriman gagal, log ke console (termasuk isi email) alih-alih
// melempar error ke pemanggil.
export async function sendMail(to: string, subject: string, html: string) {
  if (!isSmtpConfigured()) {
    console.warn(`[email.service] SMTP belum dikonfigurasi, email tidak dikirim ke ${to}`);
    console.info(`[email.service] Preview email "${subject}":\n${html}`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "Helpdesk USNI <no-reply@usni.ac.id>";
  try {
    await getTransporter().sendMail({ from, to, subject, html });
  } catch (err) {
    console.error(`[email.service] Gagal mengirim email ke ${to}:`, err);
    console.info(`[email.service] Preview email "${subject}":\n${html}`);
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendMail(
    email,
    "Verifikasi Email - Helpdesk USNI",
    `
      <p>Halo,</p>
      <p>Terima kasih telah mendaftar di Helpdesk Ticketing USNI. Klik tautan berikut untuk memverifikasi email Anda (berlaku 24 jam):</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
    `
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendMail(
    email,
    "Reset Password - Helpdesk USNI",
    `
      <p>Halo,</p>
      <p>Kami menerima permintaan reset password untuk akun Anda. Klik tautan berikut untuk mengatur password baru (berlaku 1 jam):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
    `
  );
}

/**
 * Dikirim saat Admin membuat user baru (POST /users atau bulk-upload).
 * Memakai mekanisme token yang sama dengan PasswordResetToken agar user
 * mengatur password pertamanya sendiri.
 */
export async function sendSetPasswordEmail(email: string, name: string, token: string) {
  const setPasswordUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendMail(
    email,
    "Akun Helpdesk USNI Anda Telah Dibuat",
    `
      <p>Halo ${name},</p>
      <p>Akun Anda telah dibuat di Sistem Helpdesk Ticketing USNI. Silakan atur password pertama Anda melalui tautan berikut (berlaku 1 jam):</p>
      <p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>
      <p>Gunakan email ini (${email}) untuk login setelah password diatur.</p>
    `
  );
}

export async function sendNotificationEmail(email: string, title: string, message: string) {
  await sendMail(
    email,
    title,
    `
      <p>${message}</p>
      <p>Silakan login ke Helpdesk USNI untuk detail lebih lanjut.</p>
    `
  );
}
