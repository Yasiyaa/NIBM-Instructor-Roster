import bcrypt from 'bcryptjs';
import { Prisma, Role as PrismaRole, LeaveStatus as PrismaLeaveStatus } from '@prisma/client';
import { prisma } from './prisma';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
  ExecutiveStatusReport,
  AuditLog,
  AcademicCatalog,
} from '@/types';
import { getMondayOfCurrentWeek, getSundayOfWeek } from './seed-data';

const SALT_ROUNDS = 10;
const CATALOG_ID = 'singleton';

type PrismaUser = Prisma.UserGetPayload<Record<string, never>>;

function toPublicUser(u: PrismaUser): User {
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    email: u.email ?? undefined,
    role: u.role,
    jobTitle: u.jobTitle ?? undefined,
    phone: u.phone ?? undefined,
    avatarColor: u.avatarColor ?? undefined,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
  };
}

// Login identifiers are lowercase, no spaces, letters/numbers/./_/- only.
function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '.');
}

// Generates a predictable, easy-to-relay temporary password for
// admin-created accounts: "<FirstName>@123". Honorifics (Dr., Mr., ...) are
// skipped so "Dr. Thisara" yields "Thisara@123", not "Dr@123". This is only
// ever a *temporary* credential -- mustChangePassword forces a real password
// on first sign-in, so predictability here is an onboarding convenience, not
// a long-term secret.
const HONORIFICS = new Set(['dr', 'mr', 'mrs', 'ms', 'prof']);
function generateTempPassword(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  const nameToken =
    tokens.find((t) => !HONORIFICS.has(t.replace(/\./g, '').toLowerCase())) || tokens[0] || 'User';
  const letters = nameToken.replace(/[^a-zA-Z]/g, '') || 'User';
  const capitalized = letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  return `${capitalized}@123`;
}

// If ADMIN_USERNAME / ADMIN_PASSWORD are set and no ADMIN account exists
// yet, creates one. Safe to leave the env vars in place permanently: once
// an admin exists (seeded or otherwise), this is a no-op on every later
// boot, so it never resets a live admin's password. Guarded by a
// module-level flag so a warm serverless instance only checks once, not on
// every request.
let adminSeedChecked = false;
async function ensureAdminSeeded(): Promise<void> {
  if (adminSeedChecked) return;
  adminSeedChecked = true;

  const adminUsername = process.env.ADMIN_USERNAME ? normalizeUsername(process.env.ADMIN_USERNAME) : undefined;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) return;

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) return;

  // Two cold-start serverless instances could both reach this point at once
  // (each has its own adminSeedChecked flag); let the username unique
  // constraint be the real guard and treat a conflict as "already seeded".
  let admin;
  try {
    admin = await prisma.user.create({
      data: {
        fullName: 'System Administrator',
        username: adminUsername,
        email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined,
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
        passwordHash: bcrypt.hashSync(adminPassword, SALT_ROUNDS),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return;
    }
    throw err;
  }

  await logAudit('ADMIN_SEEDED', 'User', {
    targetId: admin.id,
    metadata: `Admin account seeded from environment as "${adminUsername}"`,
  });
}

async function logAudit(
  action: string,
  targetEntity: string,
  opts: { userId?: string; targetId?: string; metadata?: string } = {}
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: opts.userId,
      action,
      targetEntity,
      targetId: opts.targetId,
      metadata: opts.metadata,
    },
  });
}

// ----------------------------------------------------
// Users & Roles
// ----------------------------------------------------
export async function getAllUsers(): Promise<User[]> {
  await ensureAdminSeeded();
  const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: { fullName: 'asc' } });
  return users.map(toPublicUser);
}

// The "instructors" account is a shared kiosk login (one physical terminal,
// no single owner), not a real cadre member -- it must never appear in the
// free-standby pool, duty-assignment dropdowns, or WhatsApp dispatch list.
// Matched by username (the stable, admin-assigned identifier) rather than a
// hardcoded id, since real accounts get a generated UUID id.
const SHARED_KIOSK_USERNAME = 'instructors';
export async function getInstructors(): Promise<User[]> {
  const users = await getAllUsers();
  return users.filter(
    (u) =>
      (u.role === 'INSTRUCTOR' || u.role === 'DEMONSTRATOR') &&
      u.id !== 'general-instructor' &&
      u.username !== SHARED_KIOSK_USERNAME
  );
}

export async function getUserById(id: string): Promise<User | undefined> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) return undefined;
  return toPublicUser(user);
}

// ----------------------------------------------------
// Authentication & Account Management
// ----------------------------------------------------
export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  await ensureAdminSeeded();
  const normalized = normalizeUsername(username);
  const stored = await prisma.user.findUnique({ where: { username: normalized } });
  if (!stored || !stored.isActive) {
    return { success: false, error: 'Invalid username or password.' };
  }
  const valid = await bcrypt.compare(password, stored.passwordHash);
  if (!valid) {
    return { success: false, error: 'Invalid username or password.' };
  }
  return { success: true, user: toPublicUser(stored) };
}

export interface CreateUserInput {
  fullName: string;
  username: string;
  email?: string;
  role: PrismaRole;
  jobTitle?: string;
  phone?: string;
}

// Admin-only: creates a staff account with a randomly generated temp
// password. The caller must relay `tempPassword` to the new user directly
// (Slack, in person, etc.) -- it is never stored in plaintext and never
// shown again after this call returns.
export async function createUser(
  input: CreateUserInput,
  actorId?: string
): Promise<{ success: true; user: User; tempPassword: string } | { success: false; error: string }> {
  const username = normalizeUsername(input.username);
  const fullName = input.fullName.trim();
  const email = input.email?.trim().toLowerCase() || undefined;
  if (!fullName || !username) {
    return { success: false, error: 'Name and username are required.' };
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, ...(email ? [{ email }] : [])] } });
  if (existing) {
    return {
      success: false,
      error:
        existing.username === username
          ? `Username "${username}" is already taken.`
          : `A user with email "${email}" already exists.`,
    };
  }

  const tempPassword = generateTempPassword(fullName);
  const created = await prisma.user.create({
    data: {
      fullName,
      username,
      email,
      role: input.role,
      jobTitle: input.jobTitle?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      isActive: true,
      mustChangePassword: true,
      passwordHash: bcrypt.hashSync(tempPassword, SALT_ROUNDS),
    },
  });

  await logAudit('USER_CREATED', 'User', {
    userId: actorId,
    targetId: created.id,
    metadata: `Created ${created.role} account "${created.username}" for ${created.fullName}`,
  });

  return { success: true, user: toPublicUser(created), tempPassword };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const stored = await prisma.user.findUnique({ where: { id: userId } });
  if (!stored) return { success: false, error: 'User not found.' };

  const valid = await bcrypt.compare(currentPassword, stored.passwordHash);
  if (!valid) return { success: false, error: 'Current password is incorrect.' };
  if (newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters.' };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: bcrypt.hashSync(newPassword, SALT_ROUNDS), mustChangePassword: false },
  });
  await logAudit('PASSWORD_CHANGED', 'User', {
    userId,
    targetId: userId,
    metadata: `${stored.fullName} changed their password`,
  });
  return { success: true };
}

// Self-service: lets a signed-in user fill in their own contact info once
// admin hands them a bare account (name + username only). Passing an empty
// string for a field clears it; omitting the field leaves it unchanged.
export async function updateOwnProfile(
  userId: string,
  input: { email?: string; phone?: string }
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  const stored = await prisma.user.findUnique({ where: { id: userId } });
  if (!stored) return { success: false, error: 'User not found.' };

  const data: Prisma.UserUpdateInput = {};

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (email) {
      const conflict = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
      if (conflict) return { success: false, error: `A user with email "${email}" already exists.` };
      data.email = email;
    } else {
      data.email = null;
    }
  }

  if (input.phone !== undefined) {
    data.phone = input.phone.trim() || null;
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  await logAudit('PROFILE_UPDATED', 'User', {
    userId,
    targetId: userId,
    metadata: `${updated.fullName} updated their contact details`,
  });
  return { success: true, user: toPublicUser(updated) };
}

export async function getAllUsersIncludingInactive(): Promise<User[]> {
  const users = await prisma.user.findMany({ orderBy: { fullName: 'asc' } });
  return users.map(toPublicUser);
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const stored = await prisma.user.findUnique({ where: { id: userId } });
  if (!stored) return { success: false, error: 'User not found.' };

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await logAudit(isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', 'User', {
    userId: actorId,
    targetId: userId,
    metadata: `${stored.fullName} (${stored.email}) ${isActive ? 'reactivated' : 'deactivated'}`,
  });
  return { success: true };
}

// Admin-only: permanently removes an account row. Deliberately narrow --
// DutyAssignment/NightShift/LeaveRequest cascade-delete on their instructor,
// and AuditLog anonymizes to "System" on its actor, so hard-deleting anyone
// with real history would either silently erase their teaching/leave record
// or gut the compliance trail's attribution. Only a deactivated account with
// zero footprint anywhere may be permanently deleted; everyone else stays
// deactivate-only.
export async function deleteUserPermanently(
  userId: string,
  actorId?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const stored = await prisma.user.findUnique({ where: { id: userId } });
  if (!stored) return { success: false, error: 'User not found.' };
  if (stored.isActive) {
    return { success: false, error: 'Deactivate this account first, then it can be permanently deleted.' };
  }

  const [duties, nights, leaves, reviewed, published, audits] = await Promise.all([
    prisma.dutyAssignment.count({ where: { instructorId: userId } }),
    prisma.nightShift.count({ where: { instructorId: userId } }),
    prisma.leaveRequest.count({ where: { instructorId: userId } }),
    prisma.leaveRequest.count({ where: { reviewedById: userId } }),
    prisma.rosterWeek.count({ where: { publishedById: userId } }),
    prisma.auditLog.count({ where: { userId } }),
  ]);
  if (duties + nights + leaves + reviewed + published + audits > 0) {
    return {
      success: false,
      error: `${stored.fullName} has schedule or audit history and can't be permanently deleted -- it stays deactivated to preserve the record.`,
    };
  }

  // Logged before the row is gone so the deletion itself is traceable;
  // targetId is a plain string field, not a foreign key, so it's fine to
  // reference an id that no longer exists after this.
  await logAudit('USER_DELETED', 'User', {
    userId: actorId,
    targetId: userId,
    metadata: `Permanently deleted ${stored.role} account "${stored.username}" (${stored.fullName})`,
  });
  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}

// ----------------------------------------------------
// Roster Weeks
// ----------------------------------------------------
function mapRosterWeek(w: Prisma.RosterWeekGetPayload<Record<string, never>>, publisherName?: string): RosterWeek {
  return {
    id: w.id,
    startDate: w.startDate,
    endDate: w.endDate,
    status: w.status,
    publishedAt: w.publishedAt?.toISOString(),
    publishedById: w.publishedById ?? undefined,
    publishedByName: publisherName,
  };
}

export async function getOrCreateRosterWeek(startDateStr?: string): Promise<RosterWeek> {
  const start = startDateStr || getMondayOfCurrentWeek();
  const end = getSundayOfWeek(start);

  // upsert (not findUnique-then-create) so two concurrent requests for the
  // same new week can't both see "missing" and race on the create.
  const week = await prisma.rosterWeek.upsert({
    where: { startDate_endDate: { startDate: start, endDate: end } },
    update: {},
    create: { id: `week-${start}`, startDate: start, endDate: end, status: 'DRAFT' },
  });
  return mapRosterWeek(week);
}

export async function getAllRosterWeeks(): Promise<RosterWeek[]> {
  const weeks = await prisma.rosterWeek.findMany({ include: { publishedBy: true } });
  return weeks.map((w) => mapRosterWeek(w, w.publishedBy?.fullName));
}

export async function publishRosterWeek(weekId: string, publishedById: string): Promise<RosterWeek> {
  const publisher = await getUserById(publishedById);
  const updated = await prisma.rosterWeek.update({
    where: { id: weekId },
    data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById },
  });

  await logAudit('ROSTER_PUBLISHED', 'RosterWeek', {
    userId: publishedById,
    targetId: weekId,
    metadata: `Published roster week ${updated.startDate} to ${updated.endDate}`,
  });
  return mapRosterWeek(updated, publisher?.fullName || 'Demonstrator');
}

// ----------------------------------------------------
// Duty Assignments
// ----------------------------------------------------
function mapDuty(a: Prisma.DutyAssignmentGetPayload<{ include: { instructor: true } }>): DutyAssignment {
  return {
    id: a.id,
    rosterWeekId: a.rosterWeekId,
    instructorId: a.instructorId,
    instructorName: a.instructor?.fullName || 'Unassigned',
    instructorPhone: a.instructor?.phone ?? undefined,
    dutyDate: a.dutyDate,
    slotLabel: a.slotLabel,
    startTime: a.startTime,
    endTime: a.endTime,
    batchName: a.batchName,
    moduleName: a.moduleName,
    roomLab: a.roomLab ?? undefined,
    notes: a.notes ?? undefined,
  };
}

export async function getDutyAssignments(weekId?: string): Promise<DutyAssignment[]> {
  if (!weekId) {
    const all = await prisma.dutyAssignment.findMany({ include: { instructor: true } });
    return all.map(mapDuty);
  }

  const week = await prisma.rosterWeek.findUnique({ where: { id: weekId } });
  const assignments = await prisma.dutyAssignment.findMany({
    where: week
      ? { OR: [{ rosterWeekId: weekId }, { dutyDate: { gte: week.startDate, lte: week.endDate } }] }
      : { rosterWeekId: weekId },
    include: { instructor: true },
  });
  return assignments.map(mapDuty);
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
  input: AddDutyInput,
  actorId?: string
): Promise<{ success: boolean; assignment?: DutyAssignment; error?: string }> {
  const instructor = await getUserById(input.instructorId);

  // 1. Check Leave Precedence Rule
  const hasApprovedLeave = await prisma.leaveRequest.findFirst({
    where: {
      instructorId: input.instructorId,
      status: 'APPROVED',
      startDate: { lte: input.dutyDate },
      endDate: { gte: input.dutyDate },
    },
  });
  if (hasApprovedLeave) {
    return {
      success: false,
      error: `Conflict: ${instructor?.fullName || 'Instructor'} is on approved leave on ${input.dutyDate}.`,
    };
  }

  // 2. Check Collision Rule: instructor already booked for this slot
  const collision = await prisma.dutyAssignment.findFirst({
    where: { dutyDate: input.dutyDate, instructorId: input.instructorId, startTime: input.startTime },
  });
  if (collision) {
    return {
      success: false,
      error: `Double Booking: ${instructor?.fullName || 'Instructor'} is already assigned to a session at ${input.startTime} on ${input.dutyDate}.`,
    };
  }

  const created = await prisma.dutyAssignment.create({
    data: input,
    include: { instructor: true },
  });

  await logAudit('DUTY_ASSIGNED', 'DutyAssignment', {
    userId: actorId,
    targetId: created.id,
    metadata: `${instructor?.fullName || ''}: ${input.batchName} / ${input.moduleName} on ${input.dutyDate} (${input.startTime}-${input.endTime})`,
  });
  return { success: true, assignment: mapDuty(created) };
}

export async function deleteDutyAssignment(assignmentId: string, actorId?: string): Promise<boolean> {
  const removed = await prisma.dutyAssignment.findUnique({
    where: { id: assignmentId },
    include: { instructor: true },
  });
  if (!removed) return false;

  await prisma.dutyAssignment.delete({ where: { id: assignmentId } });
  await logAudit('DUTY_REMOVED', 'DutyAssignment', {
    userId: actorId,
    targetId: assignmentId,
    metadata: `${removed.instructor?.fullName || 'Instructor'}: ${removed.batchName} / ${removed.moduleName} on ${removed.dutyDate} (${removed.startTime}-${removed.endTime})`,
  });
  return true;
}

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export interface CloneWeekResult {
  clonedDuties: number;
  skippedDuties: Array<{ instructorName: string; reason: string }>;
  clonedNightShifts: number;
  skippedNightShifts: Array<{ instructorName: string; reason: string }>;
}

// Clones every duty assignment and night shift from the 7 days immediately
// before `currentWeekStart` into the current draft, re-running the same
// collision/leave checks as a manual assignment for each item.
export async function cloneWeekAssignments(currentWeekStart: string, actorId?: string): Promise<CloneWeekResult> {
  const prevWeekStart = shiftDateStr(currentWeekStart, -7);
  const prevWeekEnd = shiftDateStr(currentWeekStart, -1);

  const prevDuties = await prisma.dutyAssignment.findMany({
    where: { dutyDate: { gte: prevWeekStart, lte: prevWeekEnd } },
    include: { instructor: true },
  });
  const prevNightShifts = await prisma.nightShift.findMany({
    where: { shiftDate: { gte: prevWeekStart, lte: prevWeekEnd } },
    include: { instructor: true },
  });

  const currentWeek = await getOrCreateRosterWeek(currentWeekStart);

  const result: CloneWeekResult = {
    clonedDuties: 0,
    skippedDuties: [],
    clonedNightShifts: 0,
    skippedNightShifts: [],
  };

  for (const a of prevDuties) {
    const res = await addDutyAssignment(
      {
        rosterWeekId: currentWeek.id,
        instructorId: a.instructorId,
        dutyDate: shiftDateStr(a.dutyDate, 7),
        slotLabel: a.slotLabel,
        startTime: a.startTime,
        endTime: a.endTime,
        batchName: a.batchName,
        moduleName: a.moduleName,
        roomLab: a.roomLab ?? undefined,
        notes: a.notes ?? undefined,
      },
      actorId
    );
    if (res.success) {
      result.clonedDuties++;
    } else {
      result.skippedDuties.push({
        instructorName: a.instructor?.fullName || 'Instructor',
        reason: res.error || 'Unknown conflict',
      });
    }
  }

  for (const s of prevNightShifts) {
    const res = await setNightShift(
      currentWeek.id,
      shiftDateStr(s.shiftDate, 7),
      s.instructorId,
      s.notes ?? undefined,
      actorId
    );
    if (res.success) {
      result.clonedNightShifts++;
    } else {
      result.skippedNightShifts.push({
        instructorName: s.instructor?.fullName || 'Instructor',
        reason: res.error || 'Unknown conflict',
      });
    }
  }

  const skippedTotal = result.skippedDuties.length + result.skippedNightShifts.length;
  await logAudit('WEEK_CLONED', 'RosterWeek', {
    userId: actorId,
    targetId: currentWeek.id,
    metadata: `Cloned ${result.clonedDuties} duties and ${result.clonedNightShifts} night shifts from week of ${prevWeekStart}${
      skippedTotal > 0 ? ` (${skippedTotal} skipped due to conflicts)` : ''
    }`,
  });

  return result;
}

// ----------------------------------------------------
// Night Shifts
// ----------------------------------------------------
function mapNightShift(s: Prisma.NightShiftGetPayload<{ include: { instructor: true } }>): NightShift {
  return {
    id: s.id,
    rosterWeekId: s.rosterWeekId,
    instructorId: s.instructorId,
    instructorName: s.instructor?.fullName || 'Unassigned',
    instructorPhone: s.instructor?.phone ?? undefined,
    shiftDate: s.shiftDate,
    notes: s.notes ?? undefined,
  };
}

export async function getNightShifts(weekId?: string): Promise<NightShift[]> {
  if (!weekId) {
    const all = await prisma.nightShift.findMany({ include: { instructor: true } });
    return all.map(mapNightShift);
  }

  const week = await prisma.rosterWeek.findUnique({ where: { id: weekId } });
  const shifts = await prisma.nightShift.findMany({
    where: week
      ? { OR: [{ rosterWeekId: weekId }, { shiftDate: { gte: week.startDate, lte: week.endDate } }] }
      : { rosterWeekId: weekId },
    include: { instructor: true },
  });
  return shifts.map(mapNightShift);
}

export async function setNightShift(
  rosterWeekId: string,
  shiftDate: string,
  instructorId: string,
  notes?: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const instructor = await getUserById(instructorId);

  const hasLeave = await prisma.leaveRequest.findFirst({
    where: {
      instructorId,
      status: 'APPROVED',
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate },
    },
  });
  if (hasLeave) {
    return { success: false, error: `Instructor has approved leave on ${shiftDate} and cannot take Night Duty.` };
  }

  const saved = await prisma.nightShift.upsert({
    where: { shiftDate },
    update: { instructorId, rosterWeekId, notes },
    create: { rosterWeekId, instructorId, shiftDate, notes },
  });

  await logAudit('NIGHT_DUTY_SET', 'NightShift', {
    userId: actorId,
    targetId: saved.id,
    metadata: `${instructor?.fullName || ''} set as night duty on ${shiftDate}`,
  });
  return { success: true };
}

// ----------------------------------------------------
// Leave Requests (Dual Approval: Yasith & Dr. Thisara)
// ----------------------------------------------------
function mapLeave(l: Prisma.LeaveRequestGetPayload<{ include: { instructor: true; reviewedBy: true } }>): LeaveRequest {
  return {
    id: l.id,
    instructorId: l.instructorId,
    instructorName: l.instructor?.fullName || 'Instructor',
    startDate: l.startDate,
    endDate: l.endDate,
    reason: l.reason,
    status: l.status,
    reviewedById: l.reviewedById ?? undefined,
    reviewedByName: l.reviewedBy?.fullName ?? undefined,
    reviewedAt: l.reviewedAt?.toISOString(),
    reviewComment: l.reviewComment ?? undefined,
    createdAt: l.createdAt.toISOString(),
  };
}

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const leaves = await prisma.leaveRequest.findMany({
    include: { instructor: true, reviewedBy: true },
    orderBy: { createdAt: 'desc' },
  });
  return leaves.map(mapLeave);
}

export async function createLeaveRequest(
  instructorId: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<LeaveRequest> {
  const instructor = await getUserById(instructorId);
  const created = await prisma.leaveRequest.create({
    data: { instructorId, startDate, endDate, reason, status: 'PENDING' },
    include: { instructor: true, reviewedBy: true },
  });

  await logAudit('LEAVE_REQUESTED', 'LeaveRequest', {
    userId: instructorId,
    targetId: created.id,
    metadata: `${instructor?.fullName || ''} requested leave ${startDate} to ${endDate}: ${reason}`,
  });
  return mapLeave(created);
}

export async function reviewLeaveRequest(
  leaveId: string,
  status: Extract<PrismaLeaveStatus, 'APPROVED' | 'REJECTED'>,
  reviewerId: string,
  reviewComment?: string
): Promise<LeaveRequest> {
  const reviewer = await getUserById(reviewerId);
  const updated = await prisma.leaveRequest.update({
    where: { id: leaveId },
    data: {
      status,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment: reviewComment || (status === 'APPROVED' ? 'Approved' : 'Rejected'),
    },
    include: { instructor: true, reviewedBy: true },
  });

  await logAudit(status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', 'LeaveRequest', {
    userId: reviewerId,
    targetId: leaveId,
    metadata: `${updated.instructor?.fullName || 'Instructor'}'s leave (${updated.startDate} to ${updated.endDate}) ${status.toLowerCase()} by ${reviewer?.fullName || 'Administrator'}: ${updated.reviewComment}`,
  });
  return mapLeave(updated);
}

// ----------------------------------------------------
// Executive Status Calculator (Dr. Thisara's Cockpit)
// ----------------------------------------------------
export async function getExecutiveStatus(dateStr: string, slotLabelFilter?: string): Promise<ExecutiveStatusReport> {
  const allInstructors = await getInstructors();

  // 1. Identify who is on leave on this date
  const leavesOnDate = await prisma.leaveRequest.findMany({
    where: { status: 'APPROVED', startDate: { lte: dateStr }, endDate: { gte: dateStr } },
  });
  const onLeaveIds = new Set(leavesOnDate.map((l) => l.instructorId));
  const onLeaveInstructors = leavesOnDate
    .map((l) => {
      const inst = allInstructors.find((i) => i.id === l.instructorId);
      return inst ? { instructor: inst, leave: mapLeaveMinimal(l) } : null;
    })
    .filter(Boolean) as Array<{ instructor: User; leave: LeaveRequest }>;

  // 2. Identify duties on this date
  const dayAssignmentsRaw = await prisma.dutyAssignment.findMany({
    where: { dutyDate: dateStr },
    include: { instructor: true },
  });
  const dayAssignments =
    slotLabelFilter && slotLabelFilter !== 'ALL'
      ? dayAssignmentsRaw.filter((a) => a.slotLabel.includes(slotLabelFilter) || a.startTime === slotLabelFilter)
      : dayAssignmentsRaw;

  const onDutyIds = new Set(dayAssignments.map((a) => a.instructorId));
  const onDutyInstructors = dayAssignments
    .map((a) => {
      const inst = allInstructors.find((i) => i.id === a.instructorId);
      return inst ? { instructor: inst, assignment: mapDuty(a) } : null;
    })
    .filter(Boolean) as Array<{ instructor: User; assignment: DutyAssignment }>;

  // 3. Mathematical Free Pool: Active Instructors \ (OnLeave U OnDuty)
  const freeStandby = allInstructors.filter((inst) => !onLeaveIds.has(inst.id) && !onDutyIds.has(inst.id));

  // 4. Tonight's Night Duty Instructor
  const nightShift = await prisma.nightShift.findFirst({ where: { shiftDate: dateStr } });
  const nightDutyInstructor = nightShift ? allInstructors.find((i) => i.id === nightShift.instructorId) : undefined;

  return {
    date: dateStr,
    activeSlotLabel: slotLabelFilter || 'ALL',
    onDuty: onDutyInstructors,
    freeStandby,
    onLeave: onLeaveInstructors,
    nightDutyInstructor,
  };
}

function mapLeaveMinimal(l: Prisma.LeaveRequestGetPayload<Record<string, never>>): LeaveRequest {
  return {
    id: l.id,
    instructorId: l.instructorId,
    startDate: l.startDate,
    endDate: l.endDate,
    reason: l.reason,
    status: l.status,
    reviewedById: l.reviewedById ?? undefined,
    reviewedAt: l.reviewedAt?.toISOString(),
    reviewComment: l.reviewComment ?? undefined,
    createdAt: l.createdAt.toISOString(),
  };
}

// ----------------------------------------------------
// Governance / Audit Trail (Dr. Thisara's Compliance Log)
// ----------------------------------------------------
export interface AuditLogFilter {
  action?: string; // specific action code, or 'ALL'
  userId?: string; // specific actor id, or 'ALL'
  startDate?: string; // YYYY-MM-DD, inclusive
  endDate?: string; // YYYY-MM-DD, inclusive
}

export async function getAuditLogs(filter: AuditLogFilter = {}): Promise<AuditLog[]> {
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.action && filter.action !== 'ALL') where.action = filter.action;
  if (filter.userId && filter.userId !== 'ALL') where.userId = filter.userId;
  if (filter.startDate || filter.endDate) {
    where.createdAt = {};
    if (filter.startDate) where.createdAt.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
    if (filter.endDate) where.createdAt.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return logs.map((l) => ({
    id: l.id,
    userId: l.userId ?? undefined,
    userName: l.userId ? l.user?.fullName || 'Former User' : 'System',
    action: l.action,
    targetEntity: l.targetEntity,
    targetId: l.targetId ?? undefined,
    metadata: l.metadata ?? undefined,
    createdAt: l.createdAt.toISOString(),
  }));
}

// ----------------------------------------------------
// Academic Catalog (Dynamic Batches & Rooms/Labs)
// ----------------------------------------------------
async function getOrCreateCatalogRow() {
  // upsert (not findUnique-then-create) so two concurrent first-load
  // requests can't both see "missing" and race on the create.
  return prisma.catalog.upsert({
    where: { id: CATALOG_ID },
    update: {},
    create: { id: CATALOG_ID, batches: [], rooms: [] },
  });
}

export async function getCatalog(): Promise<AcademicCatalog> {
  const row = await getOrCreateCatalogRow();
  return { batches: row.batches, rooms: row.rooms, modules: row.modules };
}

export async function addCatalogBatch(name: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Batch code cannot be empty.' };

  const row = await getOrCreateCatalogRow();
  if (row.batches.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: `Batch "${trimmed}" already exists.` };
  }
  await prisma.catalog.update({ where: { id: CATALOG_ID }, data: { batches: { push: trimmed } } });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', { userId: actorId, metadata: `Added batch "${trimmed}"` });
  return { success: true };
}

export async function removeCatalogBatch(name: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
  const row = await getOrCreateCatalogRow();
  if (!row.batches.includes(name)) return { success: false, error: `Batch "${name}" not found.` };

  await prisma.catalog.update({
    where: { id: CATALOG_ID },
    data: { batches: row.batches.filter((b) => b !== name) },
  });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', { userId: actorId, metadata: `Removed batch "${name}"` });
  return { success: true };
}

export async function updateCatalogBatch(
  oldName: string,
  newName: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = newName.trim();
  if (!trimmed) return { success: false, error: 'Batch code cannot be empty.' };

  const row = await getOrCreateCatalogRow();
  if (!row.batches.includes(oldName)) return { success: false, error: `Batch "${oldName}" not found.` };
  if (
    trimmed.toLowerCase() !== oldName.toLowerCase() &&
    row.batches.some((b) => b.toLowerCase() === trimmed.toLowerCase())
  ) {
    return { success: false, error: `Batch "${trimmed}" already exists.` };
  }

  await prisma.catalog.update({
    where: { id: CATALOG_ID },
    data: { batches: row.batches.map((b) => (b === oldName ? trimmed : b)) },
  });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', {
    userId: actorId,
    metadata: `Renamed batch "${oldName}" to "${trimmed}"`,
  });
  return { success: true };
}

export async function addCatalogRoom(name: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Room/lab name cannot be empty.' };

  const row = await getOrCreateCatalogRow();
  if (row.rooms.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: `Room/lab "${trimmed}" already exists.` };
  }
  await prisma.catalog.update({ where: { id: CATALOG_ID }, data: { rooms: { push: trimmed } } });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', { userId: actorId, metadata: `Added room/lab "${trimmed}"` });
  return { success: true };
}

export async function removeCatalogRoom(name: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
  const row = await getOrCreateCatalogRow();
  if (!row.rooms.includes(name)) return { success: false, error: `Room/lab "${name}" not found.` };

  await prisma.catalog.update({
    where: { id: CATALOG_ID },
    data: { rooms: row.rooms.filter((r) => r !== name) },
  });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', { userId: actorId, metadata: `Removed room/lab "${name}"` });
  return { success: true };
}

export async function updateCatalogRoom(
  oldName: string,
  newName: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = newName.trim();
  if (!trimmed) return { success: false, error: 'Room/lab name cannot be empty.' };

  const row = await getOrCreateCatalogRow();
  if (!row.rooms.includes(oldName)) return { success: false, error: `Room/lab "${oldName}" not found.` };
  if (
    trimmed.toLowerCase() !== oldName.toLowerCase() &&
    row.rooms.some((r) => r.toLowerCase() === trimmed.toLowerCase())
  ) {
    return { success: false, error: `Room/lab "${trimmed}" already exists.` };
  }

  await prisma.catalog.update({
    where: { id: CATALOG_ID },
    data: { rooms: row.rooms.map((r) => (r === oldName ? trimmed : r)) },
  });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', {
    userId: actorId,
    metadata: `Renamed room/lab "${oldName}" to "${trimmed}"`,
  });
  return { success: true };
}

export async function addCatalogModule(name: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Module name cannot be empty.' };

  const row = await getOrCreateCatalogRow();
  if (row.modules.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: `Module "${trimmed}" already exists.` };
  }
  await prisma.catalog.update({ where: { id: CATALOG_ID }, data: { modules: { push: trimmed } } });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', { userId: actorId, metadata: `Added module "${trimmed}"` });
  return { success: true };
}

export async function removeCatalogModule(name: string, actorId?: string): Promise<{ success: boolean; error?: string }> {
  const row = await getOrCreateCatalogRow();
  if (!row.modules.includes(name)) return { success: false, error: `Module "${name}" not found.` };

  await prisma.catalog.update({
    where: { id: CATALOG_ID },
    data: { modules: row.modules.filter((m) => m !== name) },
  });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', { userId: actorId, metadata: `Removed module "${name}"` });
  return { success: true };
}

export async function updateCatalogModule(
  oldName: string,
  newName: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = newName.trim();
  if (!trimmed) return { success: false, error: 'Module name cannot be empty.' };

  const row = await getOrCreateCatalogRow();
  if (!row.modules.includes(oldName)) return { success: false, error: `Module "${oldName}" not found.` };
  if (
    trimmed.toLowerCase() !== oldName.toLowerCase() &&
    row.modules.some((m) => m.toLowerCase() === trimmed.toLowerCase())
  ) {
    return { success: false, error: `Module "${trimmed}" already exists.` };
  }

  await prisma.catalog.update({
    where: { id: CATALOG_ID },
    data: { modules: row.modules.map((m) => (m === oldName ? trimmed : m)) },
  });
  await logAudit('CATALOG_UPDATED', 'AcademicCatalog', {
    userId: actorId,
    metadata: `Renamed module "${oldName}" to "${trimmed}"`,
  });
  return { success: true };
}
