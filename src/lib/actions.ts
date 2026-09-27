'use server';

import {
  getAllUsers,
  getAllUsersIncludingInactive,
  getInstructors,
  getOrCreateRosterWeek,
  getDutyAssignments,
  getNightShifts,
  getAllLeaveRequests,
  addDutyAssignment,
  deleteDutyAssignment,
  setNightShift,
  removeNightShift,
  publishRosterWeek,
  createLeaveRequest,
  reviewLeaveRequest,
  getExecutiveStatus,
  getAuditLogs,
  cloneWeekAssignments,
  getCachedCatalog,
  addCatalogBatch,
  removeCatalogBatch,
  updateCatalogBatch,
  addCatalogRoom,
  removeCatalogRoom,
  updateCatalogRoom,
  addCatalogModule,
  removeCatalogModule,
  updateCatalogModule,
  addCatalogDutyType,
  removeCatalogDutyType,
  updateCatalogDutyType,
  updateAutoRefreshInterval,
  verifyCredentials,
  createUser,
  changePassword,
  updateOwnProfile,
  setUserActive,
  deleteUserPermanently,
  AddDutyInput,
  AuditLogFilter,
  CreateUserInput,
} from './storage';
import { createSession, deleteSession } from './session';
import { getCurrentUser } from './auth';
import { Role, User, AiProposedDuty, AiConflictReport, AiSubstituteSuggestion } from '@/types';
import { scanRosterHealth, generateAiSchedule, findEligibleSubstitutes } from './ai-scheduler';
import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';

// Every mutating/sensitive action below re-derives the acting user from the
// signed session -- never from a client-supplied id -- and checks their
// role server-side. Client-side tab visibility is a UX convenience only;
// this is the actual authorization boundary.
async function requireAuth(): Promise<User> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('You must be signed in to do that.');
  }
  return currentUser;
}

async function requireRole(...roles: Role[]): Promise<User> {
  const currentUser = await requireAuth();
  if (!roles.includes(currentUser.role)) {
    throw new Error('You do not have permission to perform this action.');
  }
  return currentUser;
}

async function requireAdmin(): Promise<User> {
  return requireRole('ADMIN');
}

export async function getAppData(weekStartDate?: string, selectedDate?: string) {
  const todayStr = selectedDate || new Date().toISOString().split('T')[0];

  // Fetch the baseline collections concurrently
  const [users, rosterWeek, leaveRequests, catalog] = await Promise.all([
    getAllUsers(),
    getOrCreateRosterWeek(weekStartDate),
    getAllLeaveRequests(),
    getCachedCatalog(),
  ]);

  const instructors = await getInstructors(users);

  // Parallelize dependent queries, reusing preloaded instructors in getExecutiveStatus
  const [dutyAssignments, nightShifts, executiveReport] = await Promise.all([
    getDutyAssignments(rosterWeek.id),
    getNightShifts(rosterWeek.id),
    getExecutiveStatus(todayStr, undefined, instructors),
  ]);

  return {
    users,
    instructors,
    rosterWeek,
    dutyAssignments,
    nightShifts,
    leaveRequests,
    executiveReport,
    catalog,
  };
}

// ----------------------------------------------------
// Auth
// ----------------------------------------------------
export async function loginAction(username: string, password: string) {
  const result = await verifyCredentials(username, password);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }
  await createSession(result.user.id);
  revalidatePath('/');
  return { success: true as const, user: result.user };
}

export async function logoutAction() {
  await deleteSession();
  redirect('/');
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const currentUser = await requireAuth();
  const res = await changePassword(currentUser.id, currentPassword, newPassword);
  revalidatePath('/');
  return res;
}

// Self-service: any signed-in user may edit their own contact details.
export async function updateProfileAction(input: { email?: string; phone?: string }) {
  const currentUser = await requireAuth();
  const res = await updateOwnProfile(currentUser.id, input);
  revalidatePath('/');
  return res;
}

// ----------------------------------------------------
// Admin: User Management
// ----------------------------------------------------
export async function listAllUsersAction() {
  await requireAdmin();
  return getAllUsersIncludingInactive();
}

export async function createUserAction(input: CreateUserInput) {
  const admin = await requireAdmin();
  const res = await createUser(input, admin.id);
  revalidatePath('/');
  return res;
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  const admin = await requireAdmin();
  const res = await setUserActive(userId, isActive, admin.id);
  revalidatePath('/');
  return res;
}

export async function deleteUserAction(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { success: false as const, error: 'You cannot delete your own account.' };
  }
  const res = await deleteUserPermanently(userId, admin.id);
  revalidatePath('/');
  return res;
}

// ----------------------------------------------------
// Roster Planning: Demonstrator & Admin only
// ----------------------------------------------------
export async function addDutyAction(input: AddDutyInput) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addDutyAssignment(input, actor.id);
  revalidatePath('/');
  return res;
}

export async function deleteDutyAction(assignmentId: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const success = await deleteDutyAssignment(assignmentId, actor.id);
  revalidatePath('/');
  return { success };
}

export async function setNightShiftAction(rosterWeekId: string, shiftDate: string, instructorId: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await setNightShift(rosterWeekId, shiftDate, instructorId, undefined, actor.id);
  revalidatePath('/');
  return res;
}

export async function removeNightShiftAction(shiftDate: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const success = await removeNightShift(shiftDate, actor.id);
  revalidatePath('/');
  return { success };
}

export async function publishRosterAction(weekId: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const week = await publishRosterWeek(weekId, actor.id);
  revalidatePath('/');
  return { success: true, week };
}

export async function cloneWeekAction(currentWeekStart: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const result = await cloneWeekAssignments(currentWeekStart, actor.id);
  revalidatePath('/');
  return result;
}

// Every catalog mutation below also calls updateTag('catalog') to bust
// getCachedCatalog()'s cache immediately (read-your-own-writes) -- otherwise
// an edit here wouldn't show up anywhere else in the app until the cache's
// 60s TTL expired.
export async function addBatchAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogBatch(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function removeBatchAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogBatch(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function updateBatchAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogBatch(oldName, newName, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function addRoomAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogRoom(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function removeRoomAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogRoom(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function updateRoomAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogRoom(oldName, newName, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function addModuleAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogModule(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function removeModuleAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogModule(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function updateModuleAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogModule(oldName, newName, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function addDutyTypeAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogDutyType(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function removeDutyTypeAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogDutyType(name, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function updateDutyTypeAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogDutyType(oldName, newName, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

export async function updateAutoRefreshIntervalAction(seconds: number) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateAutoRefreshInterval(seconds, actor.id);
  updateTag('catalog');
  revalidatePath('/');
  return res;
}

// ----------------------------------------------------
// Leave Requests
// ----------------------------------------------------
// Security Invariant: No user (not even an admin) can apply for leave on
// someone else's behalf. The leave request is ALWAYS filed strictly for the
// currently authenticated session caller.
export async function submitLeaveAction(
  arg1: string,
  arg2: string,
  arg3: string,
  arg4?: string
) {
  const caller = await requireAuth();
  // Support both (startDate, endDate, reason) and legacy (instructorId, startDate, endDate, reason)
  const startDate = arg4 !== undefined ? arg2 : arg1;
  const endDate = arg4 !== undefined ? arg3 : arg2;
  const reason = arg4 !== undefined ? arg4 : arg3;

  const leave = await createLeaveRequest(caller.id, startDate, endDate, reason);
  revalidatePath('/');
  return { success: true, leave };
}

export async function reviewLeaveAction(leaveId: string, status: 'APPROVED' | 'REJECTED', comment?: string) {
  const actor = await requireRole('DEMONSTRATOR', 'EXECUTIVE', 'ADMIN');
  const updated = await reviewLeaveRequest(leaveId, status, actor.id, comment);
  revalidatePath('/');
  return { success: true, leave: updated };
}

// ----------------------------------------------------
// Executive Cockpit & Governance
// ----------------------------------------------------
// Intentionally not auth-gated: this backs both the internal Executive
// Cockpit and the public "no login required" status board, which by design
// shows the same on-duty/free/leave picture to anyone.
export async function getExecutiveReportAction(dateStr: string, slotFilter?: string) {
  return getExecutiveStatus(dateStr, slotFilter);
}

export async function getAuditLogsAction(filter?: AuditLogFilter) {
  await requireRole('EXECUTIVE', 'ADMIN');
  return getAuditLogs(filter);
}

// ----------------------------------------------------
// AI Roster Co-Pilot Actions
// ----------------------------------------------------

export async function scanRosterHealthAction(rosterWeekId: string): Promise<AiConflictReport> {
  await requireRole('DEMONSTRATOR', 'EXECUTIVE', 'ADMIN');
  const [allInstructors, rosterWeek, dutyAssignments, nightShifts, leaveRequests] = await Promise.all([
    getInstructors(),
    getOrCreateRosterWeek(),
    getDutyAssignments(rosterWeekId),
    getNightShifts(rosterWeekId),
    getAllLeaveRequests(),
  ]);

  return scanRosterHealth({
    rosterWeek,
    dutyAssignments,
    nightShifts,
    leaveRequests,
    allInstructors,
  });
}

export async function generateAiScheduleAction(
  rosterWeekId: string,
  prompt?: string,
  targetDate?: string
): Promise<{ success: boolean; proposed: AiProposedDuty[]; error?: string }> {
  await requireRole('DEMONSTRATOR', 'EXECUTIVE', 'ADMIN');
  try {
    const [allInstructors, rosterWeek, dutyAssignments, nightShifts, leaveRequests, catalog] = await Promise.all([
      getInstructors(),
      getOrCreateRosterWeek(),
      getDutyAssignments(rosterWeekId),
      getNightShifts(rosterWeekId),
      getAllLeaveRequests(),
      getCachedCatalog(),
    ]);

    const proposed = await generateAiSchedule({
      rosterWeek,
      dutyAssignments,
      nightShifts,
      leaveRequests,
      allInstructors,
      catalog,
      prompt,
      targetDate,
    });

    return { success: true, proposed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate schedule';
    return { success: false, proposed: [], error: message };
  }
}

export async function findAiSubstitutesAction(
  dateStr: string,
  startTime: string,
  absentInstructorId: string,
  rosterWeekId?: string
): Promise<{ success: boolean; suggestions: AiSubstituteSuggestion[]; error?: string }> {
  await requireAuth();
  try {
    const [allInstructors, week, leaveRequests] = await Promise.all([
      getInstructors(),
      getOrCreateRosterWeek(),
      getAllLeaveRequests(),
    ]);

    const targetWeekId = rosterWeekId || week.id;
    const [dutyAssignments, nightShifts] = await Promise.all([
      getDutyAssignments(targetWeekId),
      getNightShifts(targetWeekId),
    ]);

    const suggestions = findEligibleSubstitutes({
      dateStr,
      startTime,
      absentInstructorId,
      allInstructors,
      dutyAssignments,
      nightShifts,
      leaveRequests,
    });

    return { success: true, suggestions };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to find substitutes';
    return { success: false, suggestions: [], error: message };
  }
}

export async function applyAiScheduleChangesAction(
  rosterWeekId: string,
  changes: AiProposedDuty[]
): Promise<{ success: boolean; appliedCount: number; errors: string[] }> {
  const actor = await requireRole('DEMONSTRATOR', 'EXECUTIVE', 'ADMIN');
  const errors: string[] = [];
  let appliedCount = 0;

  for (const item of changes) {
    try {
      if (item.dutyType === 'Night Shift') {
        const res = await setNightShift(rosterWeekId, item.dutyDate, item.instructorId, item.notes, actor.id);
        if (res.success) {
          appliedCount++;
        } else if (res.error) {
          errors.push(`${item.dutyDate} Night Duty: ${res.error}`);
        }
      } else {
        const res = await addDutyAssignment(
          {
            rosterWeekId,
            instructorId: item.instructorId,
            dutyDate: item.dutyDate,
            slotLabel: item.slotLabel,
            startTime: item.startTime,
            endTime: item.endTime,
            dutyType: item.dutyType,
            batchName: item.batchName,
            moduleName: item.moduleName,
            roomLab: item.roomLab,
            notes: item.notes,
          },
          actor.id
        );
        if (res.success) {
          appliedCount++;
        } else if (res.error) {
          errors.push(`${item.dutyDate} ${item.startTime}: ${res.error}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${item.dutyDate} ${item.startTime}: ${msg}`);
    }
  }

  revalidatePath('/');
  return { success: true, appliedCount, errors };
}

