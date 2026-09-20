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
  publishRosterWeek,
  createLeaveRequest,
  reviewLeaveRequest,
  getExecutiveStatus,
  getAuditLogs,
  cloneWeekAssignments,
  getCatalog,
  addCatalogBatch,
  removeCatalogBatch,
  addCatalogRoom,
  removeCatalogRoom,
  verifyCredentials,
  createUser,
  changePassword,
  setUserActive,
  AddDutyInput,
  AuditLogFilter,
  CreateUserInput,
} from './storage';
import { createSession, deleteSession } from './session';
import { getCurrentUser } from './auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function getAppData(weekStartDate?: string, selectedDate?: string) {
  const users = await getAllUsers();
  const instructors = await getInstructors();
  const rosterWeek = await getOrCreateRosterWeek(weekStartDate);
  const dutyAssignments = await getDutyAssignments(rosterWeek.id);
  const nightShifts = await getNightShifts(rosterWeek.id);
  const leaveRequests = await getAllLeaveRequests();
  const catalog = await getCatalog();

  const todayStr = selectedDate || new Date().toISOString().split('T')[0];
  const executiveReport = await getExecutiveStatus(todayStr);

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
export async function loginAction(email: string, password: string) {
  const result = await verifyCredentials(email, password);
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not signed in.' };
  const res = await changePassword(currentUser.id, currentPassword, newPassword);
  revalidatePath('/');
  return res;
}

// ----------------------------------------------------
// Admin: User Management
// ----------------------------------------------------
async function requireAdmin() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'ADMIN') {
    throw new Error('Admin privileges required.');
  }
  return currentUser;
}

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

export async function addDutyAction(input: AddDutyInput, actorId?: string) {
  const res = await addDutyAssignment(input, actorId);
  revalidatePath('/');
  return res;
}

export async function deleteDutyAction(assignmentId: string, actorId?: string) {
  const success = await deleteDutyAssignment(assignmentId, actorId);
  revalidatePath('/');
  return { success };
}

export async function setNightShiftAction(rosterWeekId: string, shiftDate: string, instructorId: string, actorId?: string) {
  const res = await setNightShift(rosterWeekId, shiftDate, instructorId, undefined, actorId);
  revalidatePath('/');
  return res;
}

export async function publishRosterAction(weekId: string, publisherId: string) {
  const week = await publishRosterWeek(weekId, publisherId);
  revalidatePath('/');
  return { success: true, week };
}

export async function submitLeaveAction(instructorId: string, startDate: string, endDate: string, reason: string) {
  const leave = await createLeaveRequest(instructorId, startDate, endDate, reason);
  revalidatePath('/');
  return { success: true, leave };
}

export async function reviewLeaveAction(
  leaveId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerId: string,
  comment?: string
) {
  const updated = await reviewLeaveRequest(leaveId, status, reviewerId, comment);
  revalidatePath('/');
  return { success: true, leave: updated };
}

export async function getExecutiveReportAction(dateStr: string, slotFilter?: string) {
  return getExecutiveStatus(dateStr, slotFilter);
}

export async function getAuditLogsAction(filter?: AuditLogFilter) {
  return getAuditLogs(filter);
}

export async function cloneWeekAction(currentWeekStart: string, actorId?: string) {
  const result = await cloneWeekAssignments(currentWeekStart, actorId);
  revalidatePath('/');
  return result;
}

export async function addBatchAction(name: string, actorId?: string) {
  const res = await addCatalogBatch(name, actorId);
  revalidatePath('/');
  return res;
}

export async function removeBatchAction(name: string, actorId?: string) {
  const res = await removeCatalogBatch(name, actorId);
  revalidatePath('/');
  return res;
}

export async function addRoomAction(name: string, actorId?: string) {
  const res = await addCatalogRoom(name, actorId);
  revalidatePath('/');
  return res;
}

export async function removeRoomAction(name: string, actorId?: string) {
  const res = await removeCatalogRoom(name, actorId);
  revalidatePath('/');
  return res;
}
