import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest, DaySlotTemplate } from '@/types';

// Shared bcrypt hash (cost 10) of the local-dev/demo-only password "demo1234".
// Only ever used for these seeded fixtures -- accounts created through the
// admin onboarding flow always get their own randomly generated temp password.
const DEMO_PASSWORD_HASH = '$2b$10$e6g.pKmp4nQvISZX5pp6je0uPtlgSRiRSKnNkCRnTC9Lk1U5Z.VJS';

export const INITIAL_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'user-yasith',
    fullName: 'Yasith',
    email: 'yasith@nibm.lk',
    username: 'yasith',
    role: 'DEMONSTRATOR',
    phone: '071 257 0137',
    avatarColor: 'bg-emerald-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'user-sandali',
    fullName: 'Sandali',
    email: 'sandali@nibm.lk',
    username: 'sandali',
    role: 'DEMONSTRATOR',
    avatarColor: 'bg-rose-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'user-thisara',
    fullName: 'Dr. Thisara',
    email: 'thisara@nibm.lk',
    username: 'thisara',
    role: 'EXECUTIVE',
    phone: '071 987 6543',
    avatarColor: 'bg-blue-700',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'general-instructor',
    fullName: 'Instructors Portal (General Access)',
    email: 'instructors@nibm.lk',
    username: 'instructors',
    role: 'INSTRUCTOR',
    phone: '011 268 5697',
    avatarColor: 'bg-purple-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-1',
    fullName: 'Nithara',
    email: 'nithara@nibm.lk',
    username: 'nithara',
    role: 'INSTRUCTOR',
    phone: '074 015 0405',
    avatarColor: 'bg-indigo-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-2',
    fullName: 'Nipun',
    email: 'nipun@nibm.lk',
    username: 'nipun',
    role: 'INSTRUCTOR',
    phone: '071 217 9220',
    avatarColor: 'bg-purple-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-3',
    fullName: 'Gimasha',
    email: 'gimasha@nibm.lk',
    username: 'gimasha',
    role: 'INSTRUCTOR',
    phone: '077 116 4048',
    avatarColor: 'bg-pink-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-4',
    fullName: 'Kithnuka',
    email: 'kithnuka@nibm.lk',
    username: 'kithnuka',
    role: 'DEMONSTRATOR',
    phone: '076 783 3449',
    avatarColor: 'bg-amber-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-5',
    fullName: 'Binal',
    email: 'binal@nibm.lk',
    username: 'binal',
    role: 'INSTRUCTOR',
    phone: '071 305 5035',
    avatarColor: 'bg-teal-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-6',
    fullName: 'Poorna',
    email: 'poorna@nibm.lk',
    username: 'poorna',
    role: 'INSTRUCTOR',
    phone: '071 553 6337',
    avatarColor: 'bg-cyan-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: 'inst-7',
    fullName: 'Supun',
    email: 'supun@nibm.lk',
    username: 'supun',
    role: 'INSTRUCTOR',
    phone: '075 792 2488',
    avatarColor: 'bg-orange-600',
    isActive: true,
    passwordHash: DEMO_PASSWORD_HASH,
  },
];

export const INITIAL_BATCHES: string[] = ['DSE 24.1F', 'DCSD 24.1P', 'HDCN 23.2', 'CCS Batch', 'MIS 24.1', 'CSNE 23.1'];
export const INITIAL_ROOMS: string[] = ['Lab 01', 'Lab 02', 'Lab 03', 'Lab 04', 'CISCO Lab', 'Main Auditorium Hall'];

export const DEFAULT_SLOT_TEMPLATES: DaySlotTemplate[] = [
  {
    id: 'morning',
    label: 'Morning (09:00 - 12:00)',
    startTime: '09:00',
    endTime: '12:00',
    applicableDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  {
    id: 'afternoon',
    label: 'Afternoon (13:00 - 16:00)',
    startTime: '13:00',
    endTime: '16:00',
    applicableDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  {
    id: 'sunday-ccs',
    label: 'Sunday CCS (16:30 - 17:30)',
    startTime: '16:30',
    endTime: '17:30',
    applicableDays: [0], // Sunday
  },
];

// Calculate Monday of current week
export function getMondayOfCurrentWeek(d = new Date()): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

// Calculate Sunday of given week
export function getSundayOfWeek(mondayStr: string): string {
  const monday = new Date(mondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday.toISOString().split('T')[0];
}

export const CURRENT_MONDAY = getMondayOfCurrentWeek();
export const CURRENT_SUNDAY = getSundayOfWeek(CURRENT_MONDAY);

export const INITIAL_ROSTER_WEEKS: RosterWeek[] = [
  {
    id: 'week-current',
    startDate: CURRENT_MONDAY,
    endDate: CURRENT_SUNDAY,
    status: 'DRAFT',
  },
];

// All duty sessions cleared as requested
export const INITIAL_ASSIGNMENTS: DutyAssignment[] = [];

// Night shifts cleared for clean slate
export const INITIAL_NIGHT_SHIFTS: NightShift[] = [];

// Leave requests cleared for clean slate
export const INITIAL_LEAVES: LeaveRequest[] = [];
