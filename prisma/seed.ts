import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = [
  { code: "ADMIN", name: "Administrator" },
  { code: "IT", name: "Tim IT" },
  { code: "AKADEMIK", name: "Tim Akademik" },
  { code: "BUSP", name: "Biro Umum, Sarana, dan Prasarana" },
  { code: "PELAPOR", name: "Pelapor" },
];

const DIVISIONS = [
  { code: "IT", name: "Tim IT" },
  { code: "AKADEMIK", name: "Tim Akademik" },
  { code: "BUSP", name: "Biro Umum, Sarana, dan Prasarana" },
];

const CATEGORIES: { name: string; divisionCode: string; slaHours: number }[] = [
  { name: "Jaringan Wifi Bermasalah", divisionCode: "IT", slaHours: 4 },
  { name: "Perangkat Komputer/Laptop Rusak", divisionCode: "IT", slaHours: 8 },
  { name: "Akun Sistem Tidak Bisa Login", divisionCode: "IT", slaHours: 2 },
  { name: "Nilai Belum Keluar", divisionCode: "AKADEMIK", slaHours: 48 },
  { name: "Kesalahan Jadwal Kuliah", divisionCode: "AKADEMIK", slaHours: 24 },
  { name: "Masalah KRS/KHS", divisionCode: "AKADEMIK", slaHours: 24 },
  { name: "Proyektor Rusak", divisionCode: "BUSP", slaHours: 6 },
  { name: "AC Ruangan Tidak Dingin", divisionCode: "BUSP", slaHours: 12 },
  { name: "Kebersihan Ruangan", divisionCode: "BUSP", slaHours: 24 },
];

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@usni.ac.id";
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345";

async function main() {
  console.log("Seeding roles...");
  const roleByCode = new Map<string, { id: string; code: string }>();
  for (const role of ROLES) {
    const upserted = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: { code: role.code, name: role.name, isSystem: true },
    });
    roleByCode.set(upserted.code, upserted);
  }

  console.log("Seeding divisions...");
  const divisionByCode = new Map<string, { id: string; code: string }>();
  for (const division of DIVISIONS) {
    const upserted = await prisma.division.upsert({
      where: { code: division.code },
      update: { name: division.name },
      create: { code: division.code, name: division.name, isSystem: true },
    });
    divisionByCode.set(upserted.code, upserted);
  }

  console.log("Seeding default admin user...");
  const adminRole = roleByCode.get("ADMIN");
  if (!adminRole) throw new Error("Role ADMIN gagal di-seed");

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {},
    create: {
      name: "Administrator USNI",
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
      emailVerified: new Date(),
      isActive: true,
    },
  });

  console.log("Seeding ticket categories...");
  for (const category of CATEGORIES) {
    const division = divisionByCode.get(category.divisionCode);
    if (!division) continue;

    const existing = await prisma.ticketCategory.findFirst({
      where: { name: category.name, divisionId: division.id },
    });

    if (existing) {
      await prisma.ticketCategory.update({
        where: { id: existing.id },
        data: { slaHours: category.slaHours, isActive: true },
      });
    } else {
      await prisma.ticketCategory.create({
        data: {
          name: category.name,
          divisionId: division.id,
          slaHours: category.slaHours,
        },
      });
    }
  }

  console.log("Seed selesai.");
  console.log(`Login admin default -> email: ${DEFAULT_ADMIN_EMAIL} | password: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log("PENTING: ganti password admin default ini setelah login pertama kali.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
