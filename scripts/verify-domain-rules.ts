import {
  addDutyAssignment,
  deleteDutyAssignment,
  createLeaveRequest,
  reviewLeaveRequest,
  setNightShift,
  getExecutiveStatus,
  getInstructors,
} from '../src/lib/storage';
import { prisma } from '../src/lib/db';

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 VERIFYING NIBM ROSTER SYSTEM DOMAIN LOGIC (NEON DB)');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  try {
    // 1. Verify Cadre Count (8 teaching cadre members including Yasith & Kithnuka)
    const instructors = await getInstructors();
    assert(instructors.length === 8, `Cadre count should be exactly 8 teaching members (found: ${instructors.length})`);

    // 2. Collision Rule: Double Booking Prevention
    const testDate = `2032-11-${Math.floor(Math.random() * 20 + 10)}`; // Unique future test date
    const inst1 = instructors[0]; // Nithara
    const activeWeek = await prisma.rosterWeek.findFirst() || await prisma.rosterWeek.create({
      data: { id: 'week-test', startDate: '2032-11-01', endDate: '2032-11-07', status: 'DRAFT' }
    });

    const assign1 = await addDutyAssignment({
      rosterWeekId: activeWeek.id,
      instructorId: inst1.id,
      dutyDate: testDate,
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'DSE 24.1F',
      moduleName: 'Database Systems',
    });
    assert(assign1.success === true, 'Successfully allocated first morning slot');

    // Attempt double-booking same instructor at the same time
    const doubleBooking = await addDutyAssignment({
      rosterWeekId: activeWeek.id,
      instructorId: inst1.id,
      dutyDate: testDate,
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      batchName: 'DCSD 24.1P',
      moduleName: 'Algorithms',
    });
    assert(doubleBooking.success === false, 'Double-booking was blocked by validation engine');

    // 3. Leave Precedence Rule: Cannot assign instructor on approved leave
    const inst2 = instructors[1]; // Nipun
    const leaveReq = await createLeaveRequest(inst2.id, testDate, testDate, 'Doctor appointment');
    assert(leaveReq.status === 'PENDING', 'Leave request created in PENDING state');

    // Yasith / Dr. Thisara approves
    const approvedLeave = await reviewLeaveRequest(leaveReq.id, 'APPROVED', 'user-yasith', 'Approved for health reason');
    assert(approvedLeave.status === 'APPROVED', 'Leave transitioned to APPROVED');

    // Attempt assigning duty to inst2 on leave date
    const assignOnLeave = await addDutyAssignment({
      rosterWeekId: activeWeek.id,
      instructorId: inst2.id,
      dutyDate: testDate,
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      batchName: 'HDCN 23.2',
      moduleName: 'Networks',
    });
    assert(assignOnLeave.success === false, 'Scheduling on approved leave was blocked');

    // 4. Night Duty Allocation & Leave Conflict
    const nightShiftOnLeave = await setNightShift(activeWeek.id, testDate, inst2.id);
    assert(nightShiftOnLeave.success === false, 'Night duty assignment blocked for instructor on leave');

    const inst3 = instructors[2]; // Gimasha
    const validNightShift = await setNightShift(activeWeek.id, testDate, inst3.id, 'Caretaker');
    assert(validNightShift.success === true, 'Night duty successfully assigned to available instructor');

    // 5. Dr. Thisara's Mathematical Free Pool Calculation
    // Total teaching cadre = 8.
    // In Morning slot on testDate:
    // inst1 (Nithara) is On Duty (09:00-12:00)
    // inst2 (Nipun) is On Leave
    // inst3 (Gimasha) has night duty (daytime is free)
    // 8 - (1 On Duty + 1 On Leave) = 6 Free Standby instructors!
    const report = await getExecutiveStatus(testDate, 'Morning (09:00 - 12:00)');
    assert(report.onDuty.length === 1, `On duty count matches (Expected: 1, Found: ${report.onDuty.length})`);
    assert(report.onLeave.length === 1, `On leave count matches (Expected: 1, Found: ${report.onLeave.length})`);
    assert(report.freeStandby.length === 6, `Free standby count matches (Expected: 6, Found: ${report.freeStandby.length})`);
    assert(report.nightDutyInstructor?.id === inst3.id, `Night duty officer correctly identified (${report.nightDutyInstructor?.fullName})`);

    // 6. Cleanup test records
    if (assign1.assignment) {
      await deleteDutyAssignment(assign1.assignment.id);
    }
    await prisma.nightShift.deleteMany({ where: { shiftDate: testDate } });
    await prisma.leaveRequest.deleteMany({ where: { id: leaveReq.id } });

    console.log(`\n====================================================`);
    console.log(`🎯 RESULTS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runVerification().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
