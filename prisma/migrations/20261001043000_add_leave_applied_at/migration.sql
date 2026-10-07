-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "LeaveRequest_appliedAt_idx" ON "LeaveRequest"("appliedAt");
