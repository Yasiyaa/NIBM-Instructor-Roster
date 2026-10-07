export type Role = 'ADMIN' | 'DEMONSTRATOR' | 'EXECUTIVE' | 'INSTRUCTOR' | 'GUEST';

export type RosterStatus = 'DRAFT' | 'PUBLISHED';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  role: Role;
  jobTitle?: string;
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
  slotLabel: string;
  startTime: string; // "09:00", "13:00", etc.
  endTime: string;   // "12:00", "16:00", etc.
  dutyType: string;
  batchName?: string;
  moduleName?: string;
  roomLab?: string;
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
  appliedAt: string; // ISO 8601 string recording the exact date and time of application
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
}

export interface RosterWeek {
  id: string;
  startDate: string;
  endDate: string;
  status: RosterStatus;
  publishedAt?: string;
  publishedById?: string;
  publishedByName?: string;
}

export interface AcademicCatalog {
  batches: string[];
  rooms: string[];
  modules: string[];
  dutyTypes: string[];
  autoRefreshSeconds?: number;
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

export type TabScreen = 'schedule' | 'portal' | 'executive' | 'profile';
