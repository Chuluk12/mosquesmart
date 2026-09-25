import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_SUPER_ADMIN_USERNAME || 'superadmin';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin';

  if (!password) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD must be set in the environment before seeding (no hardcoded production passwords).');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { username },
    create: { username, name, passwordHash, role: UserRole.SUPER_ADMIN },
    update: {},
  });
  console.log(`Seeded SUPER_ADMIN user: ${admin.username}`);

  const mosque = await prisma.mosque.findFirst();
  const finalMosque = mosque ?? await prisma.mosque.create({
    data: {
      name: 'Masjid Contoh',
      address: 'Jl. Contoh No. 1',
      city: 'Bekasi',
      province: 'Jawa Barat',
      latitude: -6.2383,
      longitude: 107.1465,
      timezone: 'Asia/Jakarta',
      runningText: 'Selamat datang di Masjid Contoh — semoga Allah menerima ibadah kita',
    },
  });
  console.log(`Mosque profile ready: ${finalMosque.name}`);

  await prisma.prayerSetting.upsert({
    where: { mosqueId: finalMosque.id },
    create: { mosqueId: finalMosque.id },
    update: {},
  });
  console.log('Prayer settings ready (default offsets/iqomah).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
