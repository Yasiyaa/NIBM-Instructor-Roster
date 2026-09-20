export type Role = 'ADMIN' | 'DEMONSTRATOR' | 'EXECUTIVE' | 'INSTRUCTOR' | 'GUEST';

export type RosterStatus = 'DRAFT' | 'PUBLISHED';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// The public-safe shape of a user: this is what's ever sent to the client.
// The password hash lives only in storage.ts's internal StoredUser type and
// must never be attached here.
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  phone?: string;
  avatarColor?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
}

export interface DutyAssignment {
  id: string;
  rosterWeekId: string;
  instructorId: string;
  instructorName?: string;
  instructorPhone?: string;
  dutyDate: string; // YYYY-MM-DD
  slotLabel: string; // "Morning (09:00 - 12:00)", "Afternoon (13:00 - 16:00)", "Sunday CCS (16:30 - 17:30)", etc.
  startTime: string; // "09:00", "13:00", "16:30"
  endTime: string;   // "12:00", "16:00", "17:30"
  batchName: string; // e.g. "DSE 24.1F", "CCS", "DCSD 23.2"
  moduleName: string;// e.g. "Database Systems", "Software Architecture"
  roomLab?: string;  // e.g. "Lab 02", "Hardware Lab"
  notes?: string;
}

export interface NightShift {
  id: string;
  rosterWeekId: string;
  instructorId: string;
  instructorName?: string;
  instructorPhone?: string;
  shiftDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  instructorId: string;
  instructorName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
}

export interface RosterWeek {
  id: string;
  startDate: string; // Monday YYYY-MM-DD
  endDate: string;   // Sunday YYYY-MM-DD
  status: RosterStatus;
  publishedAt?: string;
  publishedById?: string;
  publishedByName?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  metadata?: string;
  createdAt: string;
}

export interface DaySlotTemplate {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  applicableDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

export interface ExecutiveStatusReport {
  date: string;
  activeSlotLabel: string;
  onDuty: Array<{
    instructor: User;
    assignment: DutyAssignment;
  }>;
  freeStandby: User[];
  onLeave: Array<{
    instructor: User;
    leave: LeaveRequest;
  }>;
  nightDutyInstructor?: User;
}

export interface AcademicCatalog {
  batches: string[];
  rooms: string[];
}
