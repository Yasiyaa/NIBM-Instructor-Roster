-- Adds a preloadable, admin-editable list of module/subject names,
-- matching the existing batches/rooms catalog pattern.
ALTER TABLE "Catalog" ADD COLUMN "modules" TEXT[] NOT NULL DEFAULT '{}';

-- Seed with the module names the app already suggested as hardcoded
-- quick-picks, so nobody loses the existing presets when the picker moves
-- from a hardcoded list to this DB-backed one. Only applies if empty, so
-- this is a no-op on any environment that already has modules saved.
UPDATE "Catalog" SET "modules" = ARRAY[
  'Database Management Systems',
  'Object-Oriented Programming (Java)',
  'Data Structures & Algorithms',
  'Computer Networks & Routing',
  'Cyber Security Operations',
  'Web Application Development',
  'Cloud Computing Essentials',
  'Python for Data Science'
] WHERE "modules" = '{}';
