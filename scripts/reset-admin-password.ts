// One-off recovery script: directly resets an ADMIN account's password hash
// in the database.
//
// Changing ADMIN_USERNAME / ADMIN_PASSWORD in Vercel and redeploying does
// NOT change an existing admin's password -- ensureAdminSeeded() in
// src/lib/storage.ts only ever creates the admin account once, the first
// time the app boots with no ADMIN in the database, and is deliberately a
// permanent no-op after that (so a leaked or misremembered env var can never
// silently reset a live admin's password). Use this script instead when
// you're locked out.
//
// Run with: npx tsx --env-file=.env scripts/reset-admin-password.ts <newPassword> [username]
// (omit [username] to target the only ADMIN account, if there's just one)
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const SALT_ROUNDS = 10;

async function main() {
  const [newPassword, usernameArg] = process.argv.slice(2);

  if (!newPassword) {
    console.error('Usage: npx tsx --env-file=.env scripts/reset-admin-password.ts <newPassword> [username]');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('New password must be at least 8 characters.');
    process.exit(1);
  }

  const username = usernameArg?.trim().toLowerCase() || process.env.ADMIN_USERNAME?.trim().toLowerCase();

  const admin = username
    ? await prisma.user.findUnique({ where: { username } })
    : await findTheOnlyAdmin();

  if (!admin) {
    console.error(username ? `No user found with username "${username}".` : 'No ADMIN account exists yet.');
    process.exit(1);
  }
  if (admin.role !== 'ADMIN') {
    console.error(
      `User "${admin.username}" is role ${admin.role}, not ADMIN. Refusing to touch it -- pass the admin's username explicitly.`
    );
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: bcrypt.hashSync(newPassword, SALT_ROUNDS), mustChangePassword: false },
  });

  await prisma.auditLog.create({
    data: {
      action: 'PASSWORD_RESET_VIA_SCRIPT',
      targetEntity: 'User',
      targetId: admin.id,
      metadata: `Password for admin "${admin.username}" reset directly via scripts/reset-admin-password.ts`,
    },
  });

  console.log(`Password reset for admin "${admin.username}" (${admin.fullName}). Sign in with the new password.`);
}

async function findTheOnlyAdmin() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  if (admins.length > 1) {
    console.error(
      `Multiple ADMIN accounts found (${admins.map((a) => a.username).join(', ')}). Re-run with the username to target:\n` +
        '  npx tsx --env-file=.env scripts/reset-admin-password.ts <newPassword> <username>'
    );
    process.exit(1);
  }
  return admins[0];
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
