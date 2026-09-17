import fs from 'fs';
import path from 'path';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
  ExecutiveStatusReport,
} from '@/types';
import {
  INITIAL_USERS,
  INITIAL_ROSTER_WEEKS,
  INITIAL_ASSIGNMENTS,
  INITIAL_NIGHT_SHIFTS,
  INITIAL_LEAVES,
  CURRENT_MONDAY,
  CURRENT_SUNDAY,
  getMondayOfCurrentWeek,
  getSundayOfWeek,
} from './seed-data';

interface DatabaseState {
  users: User[];
  rosterWeeks: RosterWeek[];
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'roster-store.json');

// In-memory cache
let stateCache: DatabaseState | null = null;

function loadState(): DatabaseState {
  if (stateCache) return stateCache;

  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      stateCache = JSON.parse(content);
      return stateCache!;
    }
  } catch (err) {
    console.warn('Could not read persistent file, falling back to seed state:', err);
  }

  // Initial seed
  stateCache = {
    users: [...INITIAL_USERS],
    rosterWeeks: [...INITIAL_ROSTER_WEEKS],
    dutyAssignments: [...INITIAL_ASSIGNMENTS],
    nightShifts: [...INITIAL_NIGHT_SHIFTS],
    leaveRequests: [...INITIAL_LEAVES],
  };

  saveState(stateCache);
  return stateCache;
}

function saveState(state: DatabaseState): void {
  stateCache = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write to database file:', err);
  }
}

// ----------------------------------------------------
// Users & Roles
// ----------------------------------------------------
export function getAllUsers(): User[] {
  const state = loadState();
  return state.users.filter((u) => u.isActive);
}

export function getInstructors(): User[] {
  return getAllUsers().filter(
    (u) => (u.role === 'INSTRUCTOR' || u.role === 'DEMONSTRATOR') && u.id !== 'general-instructor'
  );
}

export function getUserById(id: string): User | undefined {
  return getAllUsers().find((u) => u.id === id);
}

// ----------------------------------------------------
// Roster Weeks
// ----------------------------------------------------
export function getOrCreateRosterWeek(startDateStr?: string): RosterWeek {
  const state = loadState();
  const start = startDateStr || getMondayOfCurrentWeek();
  const end = getSundayOfWeek(start);

  let week = state.rosterWeeks.find((w) => w.startDate === start);
  if (!week) {
    week = {
      id: `week-${start}`,
      startDate: start,
      endDate: end,
      status: 'DRAFT',
    };
    state.rosterWeeks.push(week);
    saveState(state);
  }
  return week;
}

export function getAllRosterWeeks(): RosterWeek[] {
  return loadState().rosterWeeks;
}

export function publishRosterWeek(weekId: string, publishedById: string): RosterWeek {
  const state = loadState();
  const weekIndex = state.rosterWeeks.findIndex((w) => w.id === weekId);
  if (weekIndex === -1) throw new Error('Roster week not found');

  const publisher = getUserById(publishedById);
  const updated: RosterWeek = {
    ...state.rosterWeeks[weekIndex],
    status: 'PUBLISHED',
    publishedAt: new Date().toISOString(),
    publishedById,
    publishedByName: publisher?.fullName || 'Demonstrator',
  };

  state.rosterWeeks[weekIndex] = updated;
  saveState(state);
  return updated;
}

// ----------------------------------------------------
// Duty Assignments
// ----------------------------------------------------
export function getDutyAssignments(weekId?: string): DutyAssignment[] {
  const state = loadState();
  const week = weekId ? state.rosterWeeks.find((w) => w.id === weekId) : undefined;
  const assignments = weekId
    ? state.dutyAssignments.filter(
        (a) => a.rosterWeekId === weekId || (week && a.dutyDate >= week.startDate && a.dutyDate <= week.endDate)
      )
    : state.dutyAssignments;

  // Enrich with instructor name and phone
  return assignments.map((a) => {
    const inst = getUserById(a.instructorId);
    return {
      ...a,
      instructorName: inst?.fullName || 'Unassigned',
      instructorPhone: inst?.phone,
    };
  });
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

export function addDutyAssignment(input: AddDutyInput): { success: boolean; assignment?: DutyAssignment; error?: string } {
  const state = loadState();

  // 1. Check Leave Precedence Rule
  const hasApprovedLeave = state.leaveRequests.some(
    (l) =>
      l.instructorId === input.instructorId &&
      l.status === 'APPROVED' &&
      input.dutyDate >= l.startDate &&
      input.dutyDate <= l.endDate
  );
  if (hasApprovedLeave) {
    const instructor = getUserById(input.instructorId);
    return {
      success: false,
      error: `Conflict: ${instructor?.fullName || 'Instructor'} is on approved leave on ${input.dutyDate}.`,
    };
  }

  // 2. Check Collision Rule: instructor already booked for this slot
  const collision = state.dutyAssignments.some(
    (a) =>
      a.dutyDate === input.dutyDate &&
      a.instructorId === input.instructorId &&
      a.startTime === input.startTime
  );
  if (collision) {
    const instructor = getUserById(input.instructorId);
    return {
      success: false,
      error: `Double Booking: ${instructor?.fullName || 'Instructor'} is already assigned to a session at ${input.startTime} on ${input.dutyDate}.`,
    };
  }

  const newAssignment: DutyAssignment = {
    id: `assign-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...input,
    instructorName: getUserById(input.instructorId)?.fullName || '',
  };

  state.dutyAssignments.push(newAssignment);
  saveState(state);
  return { success: true, assignment: newAssignment };
}

export function deleteDutyAssignment(assignmentId: string): boolean {
  const state = loadState();
  const initialLen = state.dutyAssignments.length;
  state.dutyAssignments = state.dutyAssignments.filter((a) => a.id !== assignmentId);
  if (state.dutyAssignments.length !== initialLen) {
    saveState(state);
    return true;
  }
  return false;
}

// ----------------------------------------------------
// Night Shifts
// ----------------------------------------------------
export function getNightShifts(weekId?: string): NightShift[] {
  const state = loadState();
  const week = weekId ? state.rosterWeeks.find((w) => w.id === weekId) : undefined;
  const shifts = weekId
    ? state.nightShifts.filter(
        (s) => s.rosterWeekId === weekId || (week && s.shiftDate >= week.startDate && s.shiftDate <= week.endDate)
      )
    : state.nightShifts;

  return shifts.map((s) => {
    const inst = getUserById(s.instructorId);
    return {
      ...s,
      instructorName: inst?.fullName || 'Unassigned',
      instructorPhone: inst?.phone,
    };
  });
}

export function setNightShift(rosterWeekId: string, shiftDate: string, instructorId: string, notes?: string): { success: boolean; error?: string } {
  const state = loadState();

  // Check leave
  const hasLeave = state.leaveRequests.some(
    (l) =>
      l.instructorId === instructorId &&
      l.status === 'APPROVED' &&
      shiftDate >= l.startDate &&
      shiftDate <= l.endDate
  );
  if (hasLeave) {
    return {
      success: false,
      error: `Instructor has approved leave on ${shiftDate} and cannot take Night Duty.`,
    };
  }

  // Replace or add
  const existingIdx = state.nightShifts.findIndex((s) => s.shiftDate === shiftDate);
  const newShift: NightShift = {
    id: existingIdx !== -1 ? state.nightShifts[existingIdx].id : `ns-${Date.now()}`,
    rosterWeekId,
    instructorId,
    shiftDate,
    notes,
    instructorName: getUserById(instructorId)?.fullName || '',
  };

  if (existingIdx !== -1) {
    state.nightShifts[existingIdx] = newShift;
  } else {
    state.nightShifts.push(newShift);
  }

  saveState(state);
  return { success: true };
}

// ----------------------------------------------------
// Leave Requests (Dual Approval: Yasith & Dr. Thisara)
// ----------------------------------------------------
export function getAllLeaveRequests(): LeaveRequest[] {
  const state = loadState();
  return state.leaveRequests
    .map((l) => ({
      ...l,
      instructorName: getUserById(l.instructorId)?.fullName || 'Instructor',
      reviewedByName: l.reviewedById ? getUserById(l.reviewedById)?.fullName : undefined,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createLeaveRequest(instructorId: string, startDate: string, endDate: string, reason: string): LeaveRequest {
  const state = loadState();
  const newLeave: LeaveRequest = {
    id: `leave-${Date.now()}`,
    instructorId,
    instructorName: getUserById(instructorId)?.fullName || '',
    startDate,
    endDate,
    reason,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  state.leaveRequests.push(newLeave);
  saveState(state);
  return newLeave;
}

export function reviewLeaveRequest(
  leaveId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerId: string,
  reviewComment?: string
): LeaveRequest {
  const state = loadState();
  const leaveIdx = state.leaveRequests.findIndex((l) => l.id === leaveId);
  if (leaveIdx === -1) throw new Error('Leave request not found');

  const reviewer = getUserById(reviewerId);
  const updated: LeaveRequest = {
    ...state.leaveRequests[leaveIdx],
    status,
    reviewedById: reviewerId,
    reviewedByName: reviewer?.fullName || 'Administrator',
    reviewedAt: new Date().toISOString(),
    reviewComment: reviewComment || (status === 'APPROVED' ? 'Approved' : 'Rejected'),
  };

  state.leaveRequests[leaveIdx] = updated;
  saveState(state);
  return updated;
}

// ----------------------------------------------------
// Executive Status Calculator (Dr. Thisara's Cockpit)
// ----------------------------------------------------
export function getExecutiveStatus(dateStr: string, slotLabelFilter?: string): ExecutiveStatusReport {
  const state = loadState();
  const allInstructors = getInstructors();

  // 1. Identify who is on leave on this date
  const leavesOnDate = state.leaveRequests.filter(
    (l) => l.status === 'APPROVED' && dateStr >= l.startDate && dateStr <= l.endDate
  );
  const onLeaveInstructors = leavesOnDate
    .map((l) => {
      const inst = allInstructors.find((i) => i.id === l.instructorId);
      return inst ? { instructor: inst, leave: l } : null;
    })
    .filter(Boolean) as Array<{ instructor: User; leave: LeaveRequest }>;

  const onLeaveIds = new Set(leavesOnDate.map((l) => l.instructorId));

  // 2. Identify duties on this date
  let dayAssignments = state.dutyAssignments.filter((a) => a.dutyDate === dateStr);
  if (slotLabelFilter && slotLabelFilter !== 'ALL') {
    dayAssignments = dayAssignments.filter((a) => a.slotLabel.includes(slotLabelFilter) || a.startTime === slotLabelFilter);
  }

  const onDutyInstructors = dayAssignments
    .map((a) => {
      const inst = allInstructors.find((i) => i.id === a.instructorId);
      return inst ? { instructor: inst, assignment: a } : null;
    })
    .filter(Boolean) as Array<{ instructor: User; assignment: DutyAssignment }>;

  const onDutyIds = new Set(dayAssignments.map((a) => a.instructorId));

  // 3. Mathematical Free Pool: Active Instructors \ (OnLeave U OnDuty)
  const freeStandby = allInstructors.filter(
    (inst) => !onLeaveIds.has(inst.id) && !onDutyIds.has(inst.id)
  );

  // 4. Tonight's Night Duty Instructor
  const nightShift = state.nightShifts.find((s) => s.shiftDate === dateStr);
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
