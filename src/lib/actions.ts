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
  updateCatalogBatch,
  addCatalogRoom,
  removeCatalogRoom,
  updateCatalogRoom,
  addCatalogModule,
  removeCatalogModule,
  updateCatalogModule,
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
import { Role, User } from '@/types';
import { revalidatePath } from 'next/cache';
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

export async function addBatchAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogBatch(name, actor.id);
  revalidatePath('/');
  return res;
}

export async function removeBatchAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogBatch(name, actor.id);
  revalidatePath('/');
  return res;
}

export async function updateBatchAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogBatch(oldName, newName, actor.id);
  revalidatePath('/');
  return res;
}

export async function addRoomAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogRoom(name, actor.id);
  revalidatePath('/');
  return res;
}

export async function removeRoomAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogRoom(name, actor.id);
  revalidatePath('/');
  return res;
}

export async function updateRoomAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogRoom(oldName, newName, actor.id);
  revalidatePath('/');
  return res;
}

export async function addModuleAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await addCatalogModule(name, actor.id);
  revalidatePath('/');
  return res;
}

export async function removeModuleAction(name: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await removeCatalogModule(name, actor.id);
  revalidatePath('/');
  return res;
}

export async function updateModuleAction(oldName: string, newName: string) {
  const actor = await requireRole('DEMONSTRATOR', 'ADMIN');
  const res = await updateCatalogModule(oldName, newName, actor.id);
  revalidatePath('/');
  return res;
}

// ----------------------------------------------------
// Leave Requests
// ----------------------------------------------------
// Any signed-in user may submit a leave request. This intentionally does
// NOT require instructorId === the caller: the shared "Instructors Portal"
// kiosk account submits leave on behalf of whichever instructor is present.
export async function submitLeaveAction(instructorId: string, startDate: string, endDate: string, reason: string) {
  await requireAuth();
  const leave = await createLeaveRequest(instructorId, startDate, endDate, reason);
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
