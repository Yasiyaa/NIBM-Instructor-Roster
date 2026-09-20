import { prisma } from './db';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
  ExecutiveStatusReport,
  Role,
} from '@/types';
import {
  getMondayOfCurrentWeek,
  getSundayOfWeek,
} from './seed-data';

// ----------------------------------------------------
// Users & Roles
// ----------------------------------------------------
export async function getAllUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { fullName: 'asc' },
  });
  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role as Role,
    phone: u.phone || undefined,
    avatarColor: u.avatarColor || undefined,
    isActive: u.isActive,
  }));
}

export async function getInstructors(): Promise<User[]> {
  const all = await getAllUsers();
  return all.filter(
    (u) => (u.role === 'INSTRUCTOR' || u.role === 'DEMONSTRATOR') && u.id !== 'general-instructor'
  );
}

export async function getUserById(id: string): Promise<User | null> {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role as Role,
    phone: u.phone || undefined,
    avatarColor: u.avatarColor || undefined,
    isActive: u.isActive,
  };
}

// ----------------------------------------------------
// Roster Weeks
// ----------------------------------------------------
export async function getOrCreateRosterWeek(startDateStr?: string): Promise<RosterWeek> {
  const start = startDateStr || getMondayOfCurrentWeek();
  const end = getSundayOfWeek(start);

  let week = await prisma.rosterWeek.findUnique({
    where: {
      startDate_endDate: {
        startDate: start,
        endDate: end,
      },
    },
    include: { publishedBy: true },
  });

  if (!week) {
    week = await prisma.rosterWeek.create({
      data: {
        id: `week-${start}`,
        startDate: start,
        endDate: end,
        status: 'DRAFT',
      },
      include: { publishedBy: true },
    });
  }

  return {
    id: week.id,
    startDate: week.startDate,
    endDate: week.endDate,
    status: week.status,
    publishedAt: week.publishedAt ? week.publishedAt.toISOString() : undefined,
    publishedById: week.publishedById || undefined,
    publishedByName: week.publishedBy?.fullName || undefined,
  };
}

export async function getAllRosterWeeks(): Promise<RosterWeek[]> {
  const weeks = await prisma.rosterWeek.findMany({
    orderBy: { startDate: 'desc' },
    include: { publishedBy: true },
  });

  return weeks.map((w) => ({
    id: w.id,
    startDate: w.startDate,
    endDate: w.endDate,
    status: w.status,
    publishedAt: w.publishedAt ? w.publishedAt.toISOString() : undefined,
    publishedById: w.publishedById || undefined,
    publishedByName: w.publishedBy?.fullName || undefined,
  }));
}

export async function publishRosterWeek(weekId: string, publishedById: string): Promise<RosterWeek> {
  const publisher = await getUserById(publishedById);
  const updated = await prisma.rosterWeek.update({
    where: { id: weekId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById,
    },
    include: { publishedBy: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: publishedById,
      action: 'PUBLISH_ROSTER',
      targetEntity: 'RosterWeek',
      targetId: weekId,
      metadata: `Published week ${updated.startDate} to ${updated.endDate}`,
    },
  });

  return {
    id: updated.id,
    startDate: updated.startDate,
    endDate: updated.endDate,
    status: updated.status,
    publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : undefined,
    publishedById: updated.publishedById || undefined,
    publishedByName: updated.publishedBy?.fullName || publisher?.fullName || 'Demonstrator',
  };
}

// ----------------------------------------------------
// Duty Assignments
// ----------------------------------------------------
export async function getDutyAssignments(weekId?: string): Promise<DutyAssignment[]> {
  let where = {};
  if (weekId) {
    const week = await prisma.rosterWeek.findUnique({ where: { id: weekId } });
    if (week) {
      where = {
        OR: [
          { rosterWeekId: weekId },
          {
            AND: [
              { dutyDate: { gte: week.startDate } },
              { dutyDate: { lte: week.endDate } },
            ],
          },
        ],
      };
    } else {
      where = { rosterWeekId: weekId };
    }
  }

  const assignments = await prisma.dutyAssignment.findMany({
    where,
    include: { instructor: true },
    orderBy: [{ dutyDate: 'asc' }, { startTime: 'asc' }],
  });

  return assignments.map((a) => ({
    id: a.id,
    rosterWeekId: a.rosterWeekId,
    instructorId: a.instructorId,
    instructorName: a.instructor.fullName,
    dutyDate: a.dutyDate,
    slotLabel: a.slotLabel,
    startTime: a.startTime,
    endTime: a.endTime,
    batchName: a.batchName,
    moduleName: a.moduleName,
    roomLab: a.roomLab || undefined,
    notes: a.notes || undefined,
  }));
}

export interface AddDutyInput {
  rosterWeekId: string;
  instructorId: string;
  dutyDate: string;
  slotLabel: string;
  startTime: string;
  endTime: string;
  batchName: string;
  moduleName: string;
  roomLab?: string;
  notes?: string;
}

export async function addDutyAssignment(
  input: AddDutyInput
): Promise<{ success: boolean; assignment?: DutyAssignment; error?: string }> {
  // 1. Leave Precedence Rule: Check if on approved leave
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      instructorId: input.instructorId,
      status: 'APPROVED',
      startDate: { lte: input.dutyDate },
      endDate: { gte: input.dutyDate },
    },
    include: { instructor: true },
  });

  if (approvedLeave) {
    return {
      success: false,
      error: `Conflict: ${approvedLeave.instructor?.fullName || 'Instructor'} is on approved leave on ${input.dutyDate}.`,
    };
  }

  // 2. Collision Rule: Double Booking check
  const collision = await prisma.dutyAssignment.findFirst({
    where: {
      dutyDate: input.dutyDate,
      startTime: input.startTime,
      instructorId: input.instructorId,
    },
    include: { instructor: true },
  });

  if (collision) {
    return {
      success: false,
      error: `Double Booking: ${collision.instructor?.fullName || 'Instructor'} is already assigned to a session at ${input.startTime} on ${input.dutyDate}.`,
    };
  }

  const created = await prisma.dutyAssignment.create({
    data: {
      rosterWeekId: input.rosterWeekId,
      instructorId: input.instructorId,
      dutyDate: input.dutyDate,
      slotLabel: input.slotLabel,
      startTime: input.startTime,
      endTime: input.endTime,
      batchName: input.batchName,
      moduleName: input.moduleName,
      roomLab: input.roomLab,
      notes: input.notes,
    },
    include: { instructor: true },
  });

  return {
    success: true,
    assignment: {
      id: created.id,
      rosterWeekId: created.rosterWeekId,
      instructorId: created.instructorId,
      instructorName: created.instructor.fullName,
      dutyDate: created.dutyDate,
      slotLabel: created.slotLabel,
      startTime: created.startTime,
      endTime: created.endTime,
      batchName: created.batchName,
      moduleName: created.moduleName,
      roomLab: created.roomLab || undefined,
      notes: created.notes || undefined,
    },
  };
}

export async function deleteDutyAssignment(assignmentId: string): Promise<boolean> {
  try {
    await prisma.dutyAssignment.delete({
      where: { id: assignmentId },
    });
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// Night Shifts
// ----------------------------------------------------
export async function getNightShifts(weekId?: string): Promise<NightShift[]> {
  let where = {};
  if (weekId) {
    const week = await prisma.rosterWeek.findUnique({ where: { id: weekId } });
    if (week) {
      where = {
        OR: [
          { rosterWeekId: weekId },
          {
            AND: [
              { shiftDate: { gte: week.startDate } },
              { shiftDate: { lte: week.endDate } },
            ],
          },
        ],
      };
    } else {
      where = { rosterWeekId: weekId };
    }
  }

  const shifts = await prisma.nightShift.findMany({
    where,
    include: { instructor: true },
    orderBy: { shiftDate: 'asc' },
  });

  return shifts.map((s) => ({
    id: s.id,
    rosterWeekId: s.rosterWeekId,
    instructorId: s.instructorId,
    instructorName: s.instructor.fullName,
    shiftDate: s.shiftDate,
    notes: s.notes || undefined,
  }));
}

export async function setNightShift(
  rosterWeekId: string,
  shiftDate: string,
  instructorId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  // Check approved leave
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      instructorId,
      status: 'APPROVED',
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate },
    },
    include: { instructor: true },
  });

  if (approvedLeave) {
    return {
      success: false,
      error: `${approvedLeave.instructor?.fullName || 'Instructor'} has approved leave on ${shiftDate} and cannot take Night Duty.`,
    };
  }

  // Find existing shift for this date
  const existing = await prisma.nightShift.findFirst({
    where: { shiftDate },
  });

  if (existing) {
    await prisma.nightShift.update({
      where: { id: existing.id },
      data: {
        instructorId,
        rosterWeekId,
        notes: notes || existing.notes,
      },
    });
  } else {
    await prisma.nightShift.create({
      data: {
        rosterWeekId,
        instructorId,
        shiftDate,
        notes,
      },
    });
  }

  return { success: true };
}

// ----------------------------------------------------
// Leave Requests
// ----------------------------------------------------
export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const leaves = await prisma.leaveRequest.findMany({
    include: {
      instructor: true,
      reviewedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return leaves.map((l) => ({
    id: l.id,
    instructorId: l.instructorId,
    instructorName: l.instructor.fullName,
    startDate: l.startDate,
    endDate: l.endDate,
    reason: l.reason,
    status: l.status,
    reviewedById: l.reviewedById || undefined,
    reviewedByName: l.reviewedBy?.fullName || undefined,
    reviewedAt: l.reviewedAt ? l.reviewedAt.toISOString() : undefined,
    reviewComment: l.reviewComment || undefined,
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function createLeaveRequest(
  instructorId: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<LeaveRequest> {
  const created = await prisma.leaveRequest.create({
    data: {
      instructorId,
      startDate,
      endDate,
      reason,
      status: 'PENDING',
    },
    include: { instructor: true },
  });

  return {
    id: created.id,
    instructorId: created.instructorId,
    instructorName: created.instructor.fullName,
    startDate: created.startDate,
    endDate: created.endDate,
    reason: created.reason,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function reviewLeaveRequest(
  leaveId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerId: string,
  reviewComment?: string
): Promise<LeaveRequest> {
  const updated = await prisma.leaveRequest.update({
    where: { id: leaveId },
    data: {
      status,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment: reviewComment || (status === 'APPROVED' ? 'Approved' : 'Rejected'),
    },
    include: {
      instructor: true,
      reviewedBy: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: reviewerId,
      action: status === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      targetEntity: 'LeaveRequest',
      targetId: leaveId,
      metadata: `Status changed to ${status} for ${updated.instructor.fullName}`,
    },
  });

  return {
    id: updated.id,
    instructorId: updated.instructorId,
    instructorName: updated.instructor.fullName,
    startDate: updated.startDate,
    endDate: updated.endDate,
    reason: updated.reason,
    status: updated.status,
    reviewedById: updated.reviewedById || undefined,
    reviewedByName: updated.reviewedBy?.fullName || undefined,
    reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : undefined,
    reviewComment: updated.reviewComment || undefined,
    createdAt: updated.createdAt.toISOString(),
  };
}

// ----------------------------------------------------
// Executive Status Calculator (Dr. Thisara's Cockpit)
// ----------------------------------------------------
export async function getExecutiveStatus(
  dateStr: string,
  slotLabelFilter?: string,
  preloadedInstructors?: User[]
): Promise<ExecutiveStatusReport> {
  const allInstructors = preloadedInstructors ?? (await getInstructors());

  // 1. Approved leaves spanning dateStr
  const leavesOnDate = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: dateStr },
      endDate: { gte: dateStr },
    },
    include: { instructor: true },
  });

  const onLeaveInstructors = leavesOnDate
    .map((l) => {
      const inst = allInstructors.find((i) => i.id === l.instructorId);
      if (!inst) return null;
      return {
        instructor: inst,
        leave: {
          id: l.id,
          instructorId: l.instructorId,
          instructorName: l.instructor.fullName,
          startDate: l.startDate,
          endDate: l.endDate,
          reason: l.reason,
          status: l.status,
          createdAt: l.createdAt.toISOString(),
        },
      };
    })
    .filter(Boolean) as Array<{ instructor: User; leave: LeaveRequest }>;

  const onLeaveIds = new Set(leavesOnDate.map((l) => l.instructorId));

  // 2. Duty assignments on dateStr
  let dayAssignments = await prisma.dutyAssignment.findMany({
    where: { dutyDate: dateStr },
    include: { instructor: true },
    orderBy: { startTime: 'asc' },
  });

  if (slotLabelFilter && slotLabelFilter !== 'ALL') {
    dayAssignments = dayAssignments.filter(
      (a) => a.slotLabel.includes(slotLabelFilter) || a.startTime === slotLabelFilter
    );
  }

  const onDutyInstructors = dayAssignments
    .map((a) => {
      const inst = allInstructors.find((i) => i.id === a.instructorId);
      if (!inst) return null;
      return {
        instructor: inst,
        assignment: {
          id: a.id,
          rosterWeekId: a.rosterWeekId,
          instructorId: a.instructorId,
          instructorName: a.instructor.fullName,
          dutyDate: a.dutyDate,
          slotLabel: a.slotLabel,
          startTime: a.startTime,
          endTime: a.endTime,
          batchName: a.batchName,
          moduleName: a.moduleName,
          roomLab: a.roomLab || undefined,
          notes: a.notes || undefined,
        },
      };
    })
    .filter(Boolean) as Array<{ instructor: User; assignment: DutyAssignment }>;

  const onDutyIds = new Set(dayAssignments.map((a) => a.instructorId));

  // 3. Mathematical Free Pool: Cadre \ (OnDuty U OnLeave)
  const freeStandby = allInstructors.filter(
    (inst) => !onLeaveIds.has(inst.id) && !onDutyIds.has(inst.id)
  );

  // 4. Tonight's Night Duty Caretaker
  const nightShift = await prisma.nightShift.findFirst({
    where: { shiftDate: dateStr },
    include: { instructor: true },
  });

  const nightDutyInstructor = nightShift
    ? allInstructors.find((i) => i.id === nightShift.instructorId)
    : undefined;

  return {
    date: dateStr,
    activeSlotLabel: slotLabelFilter || 'ALL',
    onDuty: onDutyInstructors,
    freeStandby,
    onLeave: onLeaveInstructors,
    nightDutyInstructor,
  };
}
