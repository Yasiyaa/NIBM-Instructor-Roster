import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest, DaySlotTemplate } from '@/types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-yasith',
    fullName: 'Yasith',
    email: 'yasith@nibm.lk',
    role: 'DEMONSTRATOR',
    phone: '071 257 0137',
    avatarColor: 'bg-emerald-600',
    isActive: true,
  },
  {
    id: 'user-thisara',
    fullName: 'Dr. Thisara',
    email: 'thisara@nibm.lk',
    role: 'EXECUTIVE',
    phone: '071 987 6543',
    avatarColor: 'bg-blue-700',
    isActive: true,
  },
  {
    id: 'general-instructor',
    fullName: 'Instructors Portal (General Access)',
    email: 'instructors@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '011 268 5697',
    avatarColor: 'bg-purple-600',
    isActive: true,
  },
  {
    id: 'inst-1',
    fullName: 'Nithara',
    email: 'nithara@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '074 015 0405',
    avatarColor: 'bg-indigo-600',
    isActive: true,
  },
  {
    id: 'inst-2',
    fullName: 'Nipun',
    email: 'nipun@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '071 217 9220',
    avatarColor: 'bg-purple-600',
    isActive: true,
  },
  {
    id: 'inst-3',
    fullName: 'Gimasha',
    email: 'gimasha@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '077 116 4048',
    avatarColor: 'bg-pink-600',
    isActive: true,
  },
  {
    id: 'inst-4',
    fullName: 'Kithnuka',
    email: 'kithnuka@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '076 783 3449',
    avatarColor: 'bg-amber-600',
    isActive: true,
  },
  {
    id: 'inst-5',
    fullName: 'Binal',
    email: 'binal@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '071 305 5035',
    avatarColor: 'bg-teal-600',
    isActive: true,
  },
  {
    id: 'inst-6',
    fullName: 'Poorna',
    email: 'poorna@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '071 553 6337',
    avatarColor: 'bg-cyan-600',
    isActive: true,
  },
  {
    id: 'inst-7',
    fullName: 'Supun',
    email: 'supun@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '075 792 2488',
    avatarColor: 'bg-orange-600',
    isActive: true,
  },
];

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
