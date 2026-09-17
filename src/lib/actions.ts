'use server';

import {
  getAllUsers,
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
  AddDutyInput,
} from './storage';
import { revalidatePath } from 'next/cache';

export async function getAppData(weekStartDate?: string, selectedDate?: string) {
  const users = getAllUsers();
  const instructors = getInstructors();
  const rosterWeek = getOrCreateRosterWeek(weekStartDate);
  const dutyAssignments = getDutyAssignments(rosterWeek.id);
  const nightShifts = getNightShifts(rosterWeek.id);
  const leaveRequests = getAllLeaveRequests();

  const todayStr = selectedDate || new Date().toISOString().split('T')[0];
  const executiveReport = getExecutiveStatus(todayStr);

  return {
    users,
    instructors,
    rosterWeek,
    dutyAssignments,
    nightShifts,
    leaveRequests,
    executiveReport,
  };
}

export async function addDutyAction(input: AddDutyInput) {
  const res = addDutyAssignment(input);
  revalidatePath('/');
  return res;
}

export async function deleteDutyAction(assignmentId: string) {
  const success = deleteDutyAssignment(assignmentId);
  revalidatePath('/');
  return { success };
}

export async function setNightShiftAction(rosterWeekId: string, shiftDate: string, instructorId: string) {
  const res = setNightShift(rosterWeekId, shiftDate, instructorId);
  revalidatePath('/');
  return res;
}

export async function publishRosterAction(weekId: string, publisherId: string) {
  const week = publishRosterWeek(weekId, publisherId);
  revalidatePath('/');
  return { success: true, week };
}

export async function submitLeaveAction(instructorId: string, startDate: string, endDate: string, reason: string) {
  const leave = createLeaveRequest(instructorId, startDate, endDate, reason);
  revalidatePath('/');
  return { success: true, leave };
}

export async function reviewLeaveAction(
  leaveId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerId: string,
  comment?: string
) {
  const updated = reviewLeaveRequest(leaveId, status, reviewerId, comment);
  revalidatePath('/');
  return { success: true, leave: updated };
}

export async function getExecutiveReportAction(dateStr: string, slotFilter?: string) {
  return getExecutiveStatus(dateStr, slotFilter);
}
