-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DEMONSTRATOR', 'EXECUTIVE', 'INSTRUCTOR', 'GUEST');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INSTRUCTOR',
    "phone" TEXT,
    "avatarColor" TEXT DEFAULT 'indigo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterWeek" (
    "id" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" "RosterStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyAssignment" (
    "id" TEXT NOT NULL,
    "rosterWeekId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "dutyDate" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "roomLab" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightShift" (
    "id" TEXT NOT NULL,
    "rosterWeekId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "shiftDate" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NightShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "batches" TEXT[],
    "rooms" TEXT[],

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RosterWeek_startDate_endDate_key" ON "RosterWeek"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "DutyAssignment_dutyDate_startTime_instructorId_key" ON "DutyAssignment"("dutyDate", "startTime", "instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "NightShift_shiftDate_instructorId_key" ON "NightShift"("shiftDate", "instructorId");

-- AddForeignKey
ALTER TABLE "RosterWeek" ADD CONSTRAINT "RosterWeek_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_rosterWeekId_fkey" FOREIGN KEY ("rosterWeekId") REFERENCES "RosterWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightShift" ADD CONSTRAINT "NightShift_rosterWeekId_fkey" FOREIGN KEY ("rosterWeekId") REFERENCES "RosterWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightShift" ADD CONSTRAINT "NightShift_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
