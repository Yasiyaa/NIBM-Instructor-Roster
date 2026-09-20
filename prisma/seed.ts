import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function getMondayOfCurrentWeek(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getSundayOfWeek(mondayStr: string): string {
  const date = new Date(mondayStr);
  date.setDate(date.getDate() + 6);
  return date.toISOString().split('T')[0];
}

function dateOffset(mondayStr: string, days: number): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('[OK] SEEDING NEON POSTGRESQL DATABASE...');

  // Default hashed password: 123
  const defaultPasswordHash = await bcrypt.hash('123', 10);

  const users = [
    {
      id: 'user-yasith',
      fullName: 'Yasith',
      email: 'yasith@nibm.lk',
      role: Role.DEMONSTRATOR,
      phone: '071 257 0137',
      avatarColor: 'bg-emerald-600',
      isActive: true,
    },
    {
      id: 'user-thisara',
      fullName: 'Dr. Thisara',
      email: 'thisara@nibm.lk',
      role: Role.EXECUTIVE,
      phone: '071 987 6543',
      avatarColor: 'bg-blue-700',
      isActive: true,
    },
    {
      id: 'general-instructor',
      fullName: 'Instructors Portal (General Access)',
      email: 'instructors@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '011 268 5697',
      avatarColor: 'bg-purple-600',
      isActive: true,
    },
    {
      id: 'inst-1',
      fullName: 'Nithara',
      email: 'nithara@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '074 015 0405',
      avatarColor: 'bg-indigo-600',
      isActive: true,
    },
    {
      id: 'inst-2',
      fullName: 'Nipun',
      email: 'nipun@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '071 217 9220',
      avatarColor: 'bg-purple-600',
      isActive: true,
    },
    {
      id: 'inst-3',
      fullName: 'Gimasha',
      email: 'gimasha@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '077 116 4048',
      avatarColor: 'bg-pink-600',
      isActive: true,
    },
    {
      id: 'inst-4',
      fullName: 'Kithnuka',
      email: 'kithnuka@nibm.lk',
      role: Role.DEMONSTRATOR,
      phone: '076 783 3449',
      avatarColor: 'bg-amber-600',
      isActive: true,
    },
    {
      id: 'inst-5',
      fullName: 'Binal',
      email: 'binal@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '071 305 5035',
      avatarColor: 'bg-teal-600',
      isActive: true,
    },
    {
      id: 'inst-6',
      fullName: 'Poorna',
      email: 'poorna@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '071 553 6337',
      avatarColor: 'bg-cyan-600',
      isActive: true,
    },
    {
      id: 'inst-7',
      fullName: 'Supun',
      email: 'supun@nibm.lk',
      role: Role.INSTRUCTOR,
      phone: '075 792 2488',
      avatarColor: 'bg-orange-600',
      isActive: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        avatarColor: u.avatarColor,
        isActive: u.isActive,
        passwordHash: defaultPasswordHash,
      },
      create: {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        avatarColor: u.avatarColor,
        isActive: u.isActive,
        passwordHash: defaultPasswordHash,
      },
    });
  }
  console.log('Seeded ' + users.length + ' Users');

  // Create or update Current Roster Week
  const curMon = getMondayOfCurrentWeek();
  const curSun = getSundayOfWeek(curMon);

  const week = await prisma.rosterWeek.upsert({
    where: {
      startDate_endDate: {
        startDate: curMon,
        endDate: curSun,
      },
    },
    update: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: 'user-yasith',
    },
    create: {
      id: 'week-' + curMon,
      startDate: curMon,
      endDate: curSun,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: 'user-yasith',
    },
  });
  console.log('Seeded Roster Week: ' + curMon + ' -> ' + curSun);

  // Clean existing assignments for this week to avoid stale data
  await prisma.dutyAssignment.deleteMany({ where: { rosterWeekId: week.id } });
  await prisma.nightShift.deleteMany({ where: { rosterWeekId: week.id } });

  // Seed Teaching Duties for this week
  const duties = [
    // Monday
    {
      instructorId: 'inst-1', // Nithara
      dutyDate: dateOffset(curMon, 0),
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'DSE 24.1F',
      moduleName: 'Database Management Systems',
      roomLab: 'Lab 01',
    },
    {
      instructorId: 'inst-2', // Nipun
      dutyDate: dateOffset(curMon, 0),
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      batchName: 'DCSD 24.1P',
      moduleName: 'Object-Oriented Programming (Java)',
      roomLab: 'Lab 03',
    },
    // Tuesday
    {
      instructorId: 'inst-3', // Gimasha
      dutyDate: dateOffset(curMon, 1),
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'HDCN 23.2',
      moduleName: 'Computer Networks & Routing',
      roomLab: 'CISCO Lab',
    },
    {
      instructorId: 'inst-4', // Kithnuka
      dutyDate: dateOffset(curMon, 1),
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      batchName: 'DSE 24.1F',
      moduleName: 'Data Structures & Algorithms',
      roomLab: 'Lab 02',
    },
    // Wednesday
    {
      instructorId: 'inst-5', // Binal
      dutyDate: dateOffset(curMon, 2),
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'DSE 23.2',
      moduleName: 'Web Application Development',
      roomLab: 'Lab 01',
    },
    {
      instructorId: 'inst-6', // Poorna
      dutyDate: dateOffset(curMon, 2),
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      batchName: 'DCSD 24.1',
      moduleName: 'Python for Data Science',
      roomLab: 'Lab 04',
    },
    // Thursday
    {
      instructorId: 'inst-7', // Supun
      dutyDate: dateOffset(curMon, 3),
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'MIS 24.1',
      moduleName: 'Enterprise Information Systems',
      roomLab: 'Lab 02',
    },
    {
      instructorId: 'inst-1', // Nithara
      dutyDate: dateOffset(curMon, 3),
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      batchName: 'DSE 24.1F',
      moduleName: 'Cloud Computing Essentials',
      roomLab: 'Lab 03',
    },
    // Friday
    {
      instructorId: 'inst-2', // Nipun
      dutyDate: dateOffset(curMon, 4),
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'HDCN 23.2',
      moduleName: 'Network Security Fundamentals',
      roomLab: 'Lab 01',
    },
    // Sunday Special CCS Batch (16:30 - 17:30)
    {
      instructorId: 'inst-3', // Gimasha
      dutyDate: dateOffset(curMon, 6),
      slotLabel: 'Sunday CCS (16:30 - 17:30)',
      startTime: '16:30',
      endTime: '17:30',
      batchName: 'CCS Batch',
      moduleName: 'Cyber Security Operations & Threat Defense',
      roomLab: 'Main Auditorium Hall',
    },
  ];

  for (const d of duties) {
    await prisma.dutyAssignment.create({
      data: {
        ...d,
        rosterWeekId: week.id,
      },
    });
  }
  console.log('Seeded ' + duties.length + ' Duty Assignments');

  // Seed 7-Day Night Duty Rotation
  const nightRoster = [
    { day: 0, instId: 'inst-1' }, // Mon: Nithara
    { day: 1, instId: 'inst-2' }, // Tue: Nipun
    { day: 2, instId: 'inst-3' }, // Wed: Gimasha
    { day: 3, instId: 'inst-4' }, // Thu: Kithnuka
    { day: 4, instId: 'inst-5' }, // Fri: Binal
    { day: 5, instId: 'inst-6' }, // Sat: Poorna
    { day: 6, instId: 'inst-7' }, // Sun: Supun
  ];

  for (const nr of nightRoster) {
    await prisma.nightShift.create({
      data: {
        rosterWeekId: week.id,
        instructorId: nr.instId,
        shiftDate: dateOffset(curMon, nr.day),
        notes: 'Overnight campus care & lab security',
      },
    });
  }
  console.log('Seeded 7-Day Night Duty Rotation');

  // Seed Leaves
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveRequest.create({
    data: {
      id: 'leave-seeded-1',
      instructorId: 'inst-7', // Supun
      startDate: dateOffset(curMon, 4),
      endDate: dateOffset(curMon, 4),
      reason: 'Personal / Family Commitment',
      status: 'APPROVED',
      reviewedById: 'user-yasith',
      reviewedAt: new Date(),
      reviewComment: 'Approved. Lab sessions covered.',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      id: 'leave-seeded-2',
      instructorId: 'inst-5', // Binal
      startDate: dateOffset(curMon, 5),
      endDate: dateOffset(curMon, 5),
      reason: 'Medical examination',
      status: 'PENDING',
    },
  });
  console.log('Seeded Leave Requests');

  console.log('NEON DATABASE SEEDING COMPLETED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
