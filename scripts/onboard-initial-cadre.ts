// One-off onboarding script: creates the real School of Computing staff
// accounts (bare -- name, username, role/jobTitle only). Email and phone are
// intentionally left blank; each person adds their own via "My Profile" on
// first sign-in. Idempotent: skips any username that already exists, so it
// is safe to re-run after fixing a typo in one entry.
//
// Run with: npx tsx --env-file=.env scripts/onboard-initial-cadre.ts
import { createUser } from '../src/lib/storage';
import { prisma } from '../src/lib/prisma';
import { Role } from '@prisma/client';

const CADRE: Array<{ fullName: string; username: string; role: Role; jobTitle?: string }> = [
  { fullName: 'Yasith', username: 'yasith', role: 'DEMONSTRATOR' },
  { fullName: 'Sandali', username: 'sandali', role: 'DEMONSTRATOR' },
  { fullName: 'Dr. Thisara', username: 'thisara', role: 'EXECUTIVE' },
  {
    fullName: 'Instructors Portal (General Access)',
    username: 'instructors',
    role: 'INSTRUCTOR',
    jobTitle: 'Shared Kiosk Account',
  },
  { fullName: 'Nithara', username: 'nithara', role: 'INSTRUCTOR' },
  { fullName: 'Nipun', username: 'nipun', role: 'INSTRUCTOR' },
  { fullName: 'Gimasha', username: 'gimasha', role: 'INSTRUCTOR' },
  { fullName: 'Kithnuka', username: 'kithnuka', role: 'DEMONSTRATOR' },
  { fullName: 'Binal', username: 'binal', role: 'INSTRUCTOR' },
  { fullName: 'Poorna', username: 'poorna', role: 'INSTRUCTOR' },
  { fullName: 'Supun', username: 'supun', role: 'INSTRUCTOR', jobTitle: 'Technical Assistant' },
];

async function main() {
  for (const c of CADRE) {
    const existing = await prisma.user.findUnique({ where: { username: c.username } });
    if (existing) {
      console.log(`SKIP  ${c.username} (already exists)`);
      continue;
    }

    const res = await createUser({
      fullName: c.fullName,
      username: c.username,
      role: c.role,
      jobTitle: c.jobTitle,
    });

    if (!res.success) {
      console.log(`FAIL  ${c.username}: ${res.error}`);
      continue;
    }
    console.log(`OK    ${c.username.padEnd(12)} role=${c.role.padEnd(12)} tempPassword=${res.tempPassword}`);
  }

  // The kiosk account has no single owner to relay a temp password to and
  // hand off a forced first-login change -- whoever touched it first would
  // silently become the only person who knows the real password. Keep its
  // temp password as the permanent shared login instead, rotated manually
  // by admin when needed.
  await prisma.user.updateMany({
    where: { username: 'instructors' },
    data: { mustChangePassword: false },
  });
  console.log('Kiosk account "instructors" set to NOT require a forced password change.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
