-- AlterTable
ALTER TABLE "Catalog" ADD COLUMN     "dutyTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DutyAssignment" ADD COLUMN     "dutyType" TEXT NOT NULL DEFAULT 'Teaching Duty',
ALTER COLUMN "batchName" DROP NOT NULL,
ALTER COLUMN "moduleName" DROP NOT NULL;

-- Seed the duty-type presets, matching how modules were seeded in
-- 20260920200000_add_catalog_modules. Only applies if empty, so this is a
-- no-op on any environment that already has duty types saved.
UPDATE "Catalog" SET "dutyTypes" = ARRAY[
  'Teaching Duty',
  'CGU (Career Guidance Unit Call Handling)',
  'Lab Inspection'
] WHERE "dutyTypes" = '{}';
