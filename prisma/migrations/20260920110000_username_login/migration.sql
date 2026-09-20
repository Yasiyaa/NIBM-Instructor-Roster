-- Add username as nullable first so we can backfill existing rows.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill from the email local-part for every existing account.
UPDATE "User" SET "username" = lower(split_part("email", '@', 1)) WHERE "email" IS NOT NULL;

-- Fallback for any row that still has no username (no email on file).
UPDATE "User" SET "username" = 'user_' || substr(replace(id, '-', ''), 1, 8) WHERE "username" IS NULL;

-- Now enforce NOT NULL + uniqueness.
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Email is no longer the login identifier: drop its NOT NULL constraint.
-- The existing unique index on email is left in place.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
