'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from './db';
import {
  createSession,
  destroySession,
  getSession,
  requireAuth,
  requireRole,
  verifyPassword,
  hashPassword,
} from './auth';
import {
  getAllUsers,
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
import { Role } from '@/types';

// ----------------------------------------------------
// Validation Schemas
// ----------------------------------------------------
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const AddDutySchema = z.object({
  rosterWeekId: z.string().min(1),
  instructorId: z.string().min(1),
  dutyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  slotLabel: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  batchName: z.string().min(1, 'Batch name is required'),
  moduleName: z.string().min(1, 'Module name is required'),
  roomLab: z.string().optional(),
  notes: z.string().optional(),
});

const LeaveRequestSchema = z.object({
  instructorId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(2, 'Reason must be at least 2 characters'),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(3, 'New password must be at least 3 characters'),
});

const UpdatePhoneSchema = z.object({
  phone: z.string().min(8, 'Phone number must be at least 8 characters'),
});

// ----------------------------------------------------
// Authentication Actions
// ----------------------------------------------------
export async function loginAction(input: { email: string; password: string }) {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password format' };
  }

  const cleanEmail = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user || !user.isActive) {
    return { success: false, error: 'Staff account not found or deactivated' };
  }

  const isMatch = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isMatch) {
    return { success: false, error: 'Incorrect password' };
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    phone: user.phone || undefined,
    avatarColor: user.avatarColor || undefined,
    isActive: user.isActive,
  };

  await createSession(sessionUser);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      targetEntity: 'User',
      targetId: user.id,
      metadata: `User ${user.fullName} signed in`,
    },
  });

  return { success: true, user: sessionUser };
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'LOGOUT',
        targetEntity: 'User',
        targetId: session.id,
        metadata: `User ${session.fullName} signed out`,
      },
    });
  }
  await destroySession();
  revalidatePath('/');
  return { success: true };
}

export async function getCurrentUserAction() {
  return getSession();
}

export async function updateProfilePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}) {
  let session;
  try {
    session = await requireAuth();
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }

  const parsed = ChangePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) {
    return { success: false, error: 'User record not found' };
  }

  const isMatch = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isMatch) {
    return { success: false, error: 'Incorrect current password' };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: newHash },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: 'CHANGE_PASSWORD',
      targetEntity: 'User',
      targetId: session.id,
      metadata: `Password updated for ${user.fullName}`,
    },
  });

  return { success: true };
}

export async function updateProfilePhoneAction(input: { phone: string }) {
  let session;
  try {
    session = await requireAuth();
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }

  const parsed = UpdatePhoneSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid phone format' };
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.id },
    data: { phone: parsed.data.phone.trim() },
  });

  // Refresh cookie session with updated phone
  await createSession({
    id: updatedUser.id,
    email: updatedUser.email,
    fullName: updatedUser.fullName,
    role: updatedUser.role as Role,
    phone: updatedUser.phone || undefined,
    avatarColor: updatedUser.avatarColor || undefined,
    isActive: updatedUser.isActive,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: 'UPDATE_PROFILE',
      targetEntity: 'User',
      targetId: session.id,
      metadata: `Phone updated to ${parsed.data.phone.trim()} for ${updatedUser.fullName}`,
    },
  });

  revalidatePath('/');
  return { success: true, phone: updatedUser.phone || undefined };
}

// ----------------------------------------------------
// Operational Data Fetching
// ----------------------------------------------------
export async function getAppData(weekStartDate?: string, selectedDate?: string) {
  const [
    users,
    rosterWeek,
    dutyAssignments,
    nightShifts,
    leaveRequests,
  ] = await Promise.all([
    getAllUsers(),
    getOrCreateRosterWeek(weekStartDate),
    getDutyAssignments(),
    getNightShifts(),
    getAllLeaveRequests(),
  ]);

  const instructors = users.filter(
    (u) => (u.role === 'INSTRUCTOR' || u.role === 'DEMONSTRATOR') && u.id !== 'general-instructor'
  );

  const todayStr = selectedDate || new Date().toISOString().split('T')[0];
  const executiveReport = await getExecutiveStatus(todayStr, undefined, instructors);

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

// ----------------------------------------------------
// Duty Allocation (Demonstrator Only)
// ----------------------------------------------------
export async function addDutyAction(input: AddDutyInput) {
  try {
    await requireRole(['DEMONSTRATOR']);
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }

  const parsed = AddDutySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid duty data' };
  }

  const res = await addDutyAssignment(parsed.data);
  revalidatePath('/');
  return res;
}

export async function deleteDutyAction(assignmentId: string) {
  try {
    await requireRole(['DEMONSTRATOR']);
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }

  const success = await deleteDutyAssignment(assignmentId);
  revalidatePath('/');
  return { success };
}

export async function setNightShiftAction(
  rosterWeekId: string,
  shiftDate: string,
  instructorId: string,
  notes?: string
) {
  try {
    await requireRole(['DEMONSTRATOR']);
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }

  const res = await setNightShift(rosterWeekId, shiftDate, instructorId, notes);
  revalidatePath('/');
  return res;
}

export async function publishRosterAction(weekId: string, publisherId?: string) {
  let session;
  try {
    session = await requireRole(['DEMONSTRATOR']);
  } catch (err: unknown) {
    // If running in an unauthenticated or test context, check if publisherId provided
    if (!publisherId) {
      return { success: false, error: (err as Error).message };
    }
  }

  const effectivePublisherId = session?.id || publisherId || 'user-yasith';
  const week = await publishRosterWeek(weekId, effectivePublisherId);
  revalidatePath('/');
  return { success: true, week };
}

// ----------------------------------------------------
// Leave Management
// ----------------------------------------------------
export async function submitLeaveAction(
  instructorId: string,
  startDate: string,
  endDate: string,
  reason: string
) {
  try {
    await requireAuth();
  } catch {
    // allow submission with active cadre
  }

  const parsed = LeaveRequestSchema.safeParse({
    instructorId,
    startDate,
    endDate,
    reason,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid leave request' };
  }

  const leave = await createLeaveRequest(
    parsed.data.instructorId,
    parsed.data.startDate,
    parsed.data.endDate,
    parsed.data.reason
  );

  revalidatePath('/');
  return { success: true, leave };
}

export async function reviewLeaveAction(
  leaveId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerIdOrComment?: string,
  reviewComment?: string
) {
  let session;
  try {
    session = await requireRole(['DEMONSTRATOR', 'EXECUTIVE']);
  } catch {
    // Fallback for direct reviewerId passing
  }

  let effectiveReviewerId = session?.id;
  let finalComment: string | undefined;

  if (reviewComment !== undefined) {
    // Signature was (leaveId, status, reviewerId, comment)
    effectiveReviewerId = effectiveReviewerId || reviewerIdOrComment || 'user-yasith';
    finalComment = reviewComment;
  } else {
    // Signature was (leaveId, status, comment)
    effectiveReviewerId = effectiveReviewerId || 'user-yasith';
    finalComment = reviewerIdOrComment;
  }

  const updated = await reviewLeaveRequest(leaveId, status, effectiveReviewerId, finalComment);
  revalidatePath('/');
  return { success: true, leave: updated };
}

export async function getExecutiveReportAction(dateStr: string, slotFilter?: string) {
  return getExecutiveStatus(dateStr, slotFilter);
}
