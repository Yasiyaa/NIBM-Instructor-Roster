-- DropIndex
DROP INDEX "NightShift_shiftDate_instructorId_key";

-- CreateIndex
CREATE UNIQUE INDEX "NightShift_shiftDate_key" ON "NightShift"("shiftDate");
