import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest, DaySlotTemplate } from '@/types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-yasith',
    fullName: 'Yasith (You)',
    email: 'yasith@nibm.lk',
    role: 'DEMONSTRATOR',
    phone: '+94 77 123 4567',
    avatarColor: 'bg-emerald-600',
    isActive: true,
  },
  {
    id: 'user-thisara',
    fullName: 'Dr. Thisara',
    email: 'thisara@nibm.lk',
    role: 'EXECUTIVE',
    phone: '+94 71 987 6543',
    avatarColor: 'bg-blue-700',
    isActive: true,
  },
  {
    id: 'general-instructor',
    fullName: 'Instructors Portal (General Access)',
    email: 'instructors@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 11 268 5697',
    avatarColor: 'bg-purple-600',
    isActive: true,
  },
  {
    id: 'inst-1',
    fullName: 'Ruwan Perera',
    email: 'ruwan.p@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 76 111 2233',
    avatarColor: 'bg-indigo-600',
    isActive: true,
  },
  {
    id: 'inst-2',
    fullName: 'Chaminda Silva',
    email: 'chaminda.s@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 77 222 3344',
    avatarColor: 'bg-purple-600',
    isActive: true,
  },
  {
    id: 'inst-3',
    fullName: 'Kavindi Fernando',
    email: 'kavindi.f@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 75 333 4455',
    avatarColor: 'bg-pink-600',
    isActive: true,
  },
  {
    id: 'inst-4',
    fullName: 'Dilshan Wickramasinghe',
    email: 'dilshan.w@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 78 444 5566',
    avatarColor: 'bg-amber-600',
    isActive: true,
  },
  {
    id: 'inst-5',
    fullName: 'Sanduni Jayawardena',
    email: 'sanduni.j@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 71 555 6677',
    avatarColor: 'bg-teal-600',
    isActive: true,
  },
  {
    id: 'inst-6',
    fullName: 'Kasun Bandara',
    email: 'kasun.b@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 72 666 7788',
    avatarColor: 'bg-cyan-600',
    isActive: true,
  },
  {
    id: 'inst-7',
    fullName: 'Nuwan Alwis',
    email: 'nuwan.a@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 70 777 8899',
    avatarColor: 'bg-orange-600',
    isActive: true,
  },
  {
    id: 'inst-8',
    fullName: 'Sachini Rathnayake',
    email: 'sachini.r@nibm.lk',
    role: 'INSTRUCTOR',
    phone: '+94 76 888 9900',
    avatarColor: 'bg-rose-600',
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
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function getSundayOfWeek(mondayStr: string): string {
  const date = new Date(mondayStr);
  date.setDate(date.getDate() + 6);
  return date.toISOString().split('T')[0];
}

export const CURRENT_MONDAY = getMondayOfCurrentWeek();
export const CURRENT_SUNDAY = getSundayOfWeek(CURRENT_MONDAY);

export const INITIAL_ROSTER_WEEKS: RosterWeek[] = [
  {
    id: 'week-current',
    startDate: CURRENT_MONDAY,
    endDate: CURRENT_SUNDAY,
    status: 'PUBLISHED',
    publishedAt: new Date().toISOString(),
    publishedById: 'user-yasith',
    publishedByName: 'Yasith',
  },
];

// Helper to get date string offset from Monday
function dateOffset(days: number): string {
  const d = new Date(CURRENT_MONDAY);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const INITIAL_ASSIGNMENTS: DutyAssignment[] = [
  // Monday
  {
    id: 'assign-1',
    rosterWeekId: 'week-current',
    instructorId: 'inst-1', // Ruwan
    dutyDate: dateOffset(0),
    slotLabel: 'Morning (09:00 - 12:00)',
    startTime: '09:00',
    endTime: '12:00',
    batchName: 'DSE 24.1F',
    moduleName: 'Database Management Systems',
    roomLab: 'Lab 01',
  },
  {
    id: 'assign-2',
    rosterWeekId: 'week-current',
    instructorId: 'inst-2', // Chaminda
    dutyDate: dateOffset(0),
    slotLabel: 'Afternoon (13:00 - 16:00)',
    startTime: '13:00',
    endTime: '16:00',
    batchName: 'DCSD 24.1P',
    moduleName: 'Object-Oriented Programming (Java)',
    roomLab: 'Lab 03',
  },
  // Tuesday
  {
    id: 'assign-3',
    rosterWeekId: 'week-current',
    instructorId: 'inst-3', // Kavindi
    dutyDate: dateOffset(1),
    slotLabel: 'Morning (09:00 - 12:00)',
    startTime: '09:00',
    endTime: '12:00',
    batchName: 'HDCN 23.2',
    moduleName: 'Computer Networks & Routing',
    roomLab: 'CISCO Lab',
  },
  {
    id: 'assign-4',
    rosterWeekId: 'week-current',
    instructorId: 'inst-4', // Dilshan
    dutyDate: dateOffset(1),
    slotLabel: 'Afternoon (13:00 - 16:00)',
    startTime: '13:00',
    endTime: '16:00',
    batchName: 'DSE 24.1F',
    moduleName: 'Data Structures & Algorithms',
    roomLab: 'Lab 02',
  },
  // Wednesday
  {
    id: 'assign-5',
    rosterWeekId: 'week-current',
    instructorId: 'inst-5', // Sanduni
    dutyDate: dateOffset(2),
    slotLabel: 'Morning (09:00 - 12:00)',
    startTime: '09:00',
    endTime: '12:00',
    batchName: 'DSE 23.2',
    moduleName: 'Web Application Development',
    roomLab: 'Lab 01',
  },
  {
    id: 'assign-6',
    rosterWeekId: 'week-current',
    instructorId: 'inst-6', // Kasun
    dutyDate: dateOffset(2),
    slotLabel: 'Afternoon (13:00 - 16:00)',
    startTime: '13:00',
    endTime: '16:00',
    batchName: 'DCSD 24.1',
    moduleName: 'Python for Data Science',
    roomLab: 'Lab 04',
  },
  // Thursday (Today if today falls on Thursday, or active slot)
  {
    id: 'assign-7',
    rosterWeekId: 'week-current',
    instructorId: 'inst-7', // Nuwan
    dutyDate: dateOffset(3),
    slotLabel: 'Morning (09:00 - 12:00)',
    startTime: '09:00',
    endTime: '12:00',
    batchName: 'MIS 24.1',
    moduleName: 'Enterprise Information Systems',
    roomLab: 'Lab 02',
  },
  {
    id: 'assign-8',
    rosterWeekId: 'week-current',
    instructorId: 'inst-8', // Sachini
    dutyDate: dateOffset(3),
    slotLabel: 'Afternoon (13:00 - 16:00)',
    startTime: '13:00',
    endTime: '16:00',
    batchName: 'DSE 24.1F',
    moduleName: 'Cloud Computing Essentials',
    roomLab: 'Lab 03',
  },
  // Friday
  {
    id: 'assign-9',
    rosterWeekId: 'week-current',
    instructorId: 'inst-1', // Ruwan
    dutyDate: dateOffset(4),
    slotLabel: 'Morning (09:00 - 12:00)',
    startTime: '09:00',
    endTime: '12:00',
    batchName: 'HDCN 23.2',
    moduleName: 'Network Security Fundamentals',
    roomLab: 'Lab 01',
  },
  // Sunday Special CCS Session (16:30 - 17:30)
  {
    id: 'assign-10',
    rosterWeekId: 'week-current',
    instructorId: 'inst-3', // Kavindi
    dutyDate: dateOffset(6), // Sunday
    slotLabel: 'Sunday CCS (16:30 - 17:30)',
    startTime: '16:30',
    endTime: '17:30',
    batchName: 'CCS Batch',
    moduleName: 'Cyber Security Operations & Threat Defense',
    roomLab: 'Main Auditorium Hall',
  },
];

export const INITIAL_NIGHT_SHIFTS: NightShift[] = [
  { id: 'ns-1', rosterWeekId: 'week-current', instructorId: 'inst-1', shiftDate: dateOffset(0) }, // Mon: Ruwan
  { id: 'ns-2', rosterWeekId: 'week-current', instructorId: 'inst-2', shiftDate: dateOffset(1) }, // Tue: Chaminda
  { id: 'ns-3', rosterWeekId: 'week-current', instructorId: 'inst-3', shiftDate: dateOffset(2) }, // Wed: Kavindi
  { id: 'ns-4', rosterWeekId: 'week-current', instructorId: 'inst-4', shiftDate: dateOffset(3) }, // Thu: Dilshan
  { id: 'ns-5', rosterWeekId: 'week-current', instructorId: 'inst-5', shiftDate: dateOffset(4) }, // Fri: Sanduni
  { id: 'ns-6', rosterWeekId: 'week-current', instructorId: 'inst-6', shiftDate: dateOffset(5) }, // Sat: Kasun
  { id: 'ns-7', rosterWeekId: 'week-current', instructorId: 'inst-7', shiftDate: dateOffset(6) }, // Sun: Nuwan
];

export const INITIAL_LEAVES: LeaveRequest[] = [
  {
    id: 'leave-1',
    instructorId: 'inst-8', // Sachini
    startDate: dateOffset(4), // Friday
    endDate: dateOffset(4),
    reason: 'Family event / Personal matter',
    status: 'APPROVED',
    reviewedById: 'user-yasith',
    reviewedByName: 'Yasith',
    reviewedAt: new Date().toISOString(),
    reviewComment: 'Approved. Lab coverage handled by Ruwan.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'leave-2',
    instructorId: 'inst-5', // Sanduni
    startDate: dateOffset(5), // Saturday
    endDate: dateOffset(5),
    reason: 'Medical appointment',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];
