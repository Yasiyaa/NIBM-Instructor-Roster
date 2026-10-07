-- Prisma does not auto-index foreign key scalar columns. These serve the
-- actual query patterns in src/lib/storage.ts: week-scoped lookups
-- (rosterWeekId), the leave-precedence check hit on every duty/night-shift
-- assignment (instructorId + status + date range), the executive
-- dashboard's daily on-leave lookup, and audit-log filtering/sorting.
CREATE INDEX IF NOT EXISTS "DutyAssignment_rosterWeekId_idx" ON "DutyAssignment"("rosterWeekId");
CREATE INDEX IF NOT EXISTS "DutyAssignment_instructorId_idx" ON "DutyAssignment"("instructorId");

CREATE INDEX IF NOT EXISTS "NightShift_rosterWeekId_idx" ON "NightShift"("rosterWeekId");
CREATE INDEX IF NOT EXISTS "NightShift_instructorId_idx" ON "NightShift"("instructorId");

CREATE INDEX IF NOT EXISTS "LeaveRequest_instructorId_status_startDate_endDate_idx" ON "LeaveRequest"("instructorId", "status", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_startDate_endDate_idx" ON "LeaveRequest"("status", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "LeaveRequest_reviewedById_idx" ON "LeaveRequest"("reviewedById");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
