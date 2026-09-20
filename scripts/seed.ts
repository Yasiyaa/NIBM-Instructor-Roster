// Seeds the 8-member instructor cadre + kiosk/executive accounts, the
// current roster week, and the default academic catalog into whichever
// database DATABASE_URL currently points at. Idempotent (safe to re-run) --
// upserts by username, so it never duplicates fixtures.
//
// This is dev/test fixture data, not something to run against a real
// production database: production should start with only the env-seeded
// ADMIN account and have real staff added through the admin onboarding UI.
import { PrismaClient } from '@prisma/client';
import { INITIAL_USERS, INITIAL_ROSTER_WEEKS, INITIAL_BATCHES, INITIAL_ROOMS } from '../src/lib/seed-data';

const prisma = new PrismaClient();

async function main() {
  for (const u of INITIAL_USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        email: u.email,
        role: u.role,
        phone: u.phone,
        avatarColor: u.avatarColor,
        isActive: u.isActive,
        passwordHash: u.passwordHash,
        mustChangePassword: false,
      },
    });
  }
  console.log(`Seeded ${INITIAL_USERS.length} users.`);

  for (const w of INITIAL_ROSTER_WEEKS) {
    await prisma.rosterWeek.upsert({
      where: { startDate_endDate: { startDate: w.startDate, endDate: w.endDate } },
      update: {},
      create: { id: w.id, startDate: w.startDate, endDate: w.endDate, status: w.status },
    });
  }
  console.log(`Seeded ${INITIAL_ROSTER_WEEKS.length} roster week(s).`);

  await prisma.catalog.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', batches: INITIAL_BATCHES, rooms: INITIAL_ROOMS },
  });
  console.log('Seeded academic catalog.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
