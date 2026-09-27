// Runs against the dedicated Neon "test" branch (TEST_DATABASE_URL), never
// the production database, so this suite can never write real leave
// requests / night shifts / audit entries into live data. Create the branch
// once with: neon branches create --name test --parent production
if (!process.env.TEST_DATABASE_URL || !process.env.TEST_DATABASE_URL_UNPOOLED) {
  console.error(
    '❌ TEST_DATABASE_URL / TEST_DATABASE_URL_UNPOOLED are not set. Add a dedicated Neon test branch to .env before running tests.'
  );
  process.exit(1);
}
function ensureConnectTimeout(urlStr: string): string {
  if (urlStr.includes('connect_timeout=')) return urlStr;
  const separator = urlStr.includes('?') ? '&' : '?';
  return `${urlStr}${separator}connect_timeout=20`;
}

process.env.DATABASE_URL = ensureConnectTimeout(process.env.TEST_DATABASE_URL);
process.env.DATABASE_URL_UNPOOLED = ensureConnectTimeout(process.env.TEST_DATABASE_URL_UNPOOLED);

async function main() {
  const {
    addDutyAssignment,
    deleteDutyAssignment,
    createLeaveRequest,
    reviewLeaveRequest,
    setNightShift,
    getExecutiveStatus,
    getInstructors,
    getOrCreateRosterWeek,
  } = await import('../src/lib/storage');
  const { isSameSession, getMatchingOppositeSlotDuty, mergeDutyAssignments } = await import('../src/lib/roster-utils');
  const { prisma } = await import('../src/lib/prisma');

  console.log('====================================================');
  console.log('🧪 VERIFYING NIBM ROSTER SYSTEM DOMAIN LOGIC (Neon test branch)');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;
  const createdLeaveIds: string[] = [];
  const createdNightShiftDates: string[] = [];

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
    // 1. Verify Cadre Count
    const instructors = await getInstructors();
    assert(instructors.length === 9, `Cadre count should be exactly 9 instructors (found: ${instructors.length})`);

    // 2. Collision Rule: Double Booking Prevention
    const testDate = `2030-05-${Math.floor(Math.random() * 20 + 10)}`; // Unique future test date
    const week = await getOrCreateRosterWeek('2030-05-06'); // Monday of that test week
    const inst1 = instructors[0];

    const assign1 = await addDutyAssignment({
      rosterWeekId: week.id,
      instructorId: inst1.id,
      dutyDate: testDate,
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      dutyType: 'Teaching Duty',
      batchName: 'DSE 24.1F',
      moduleName: 'Database Systems',
    });
    assert(assign1.success === true, 'Successfully allocated first morning slot');

    // Attempt double-booking same instructor at the same time
    const doubleBooking = await addDutyAssignment({
      rosterWeekId: week.id,
      instructorId: inst1.id,
      dutyDate: testDate,
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      dutyType: 'Teaching Duty',
      batchName: 'DCSD 24.1P',
      moduleName: 'Algorithms',
    });
    assert(doubleBooking.success === false, 'Double-booking was blocked by validation engine');

    // 3. Leave Precedence Rule: Cannot assign instructor on approved leave
    const inst2 = instructors[1];
    const leaveReq = await createLeaveRequest(inst2.id, testDate, testDate, 'Doctor appointment');
    createdLeaveIds.push(leaveReq.id);
    assert(leaveReq.status === 'PENDING', 'Leave request created in PENDING state');

    // Yasith / Dr. Thisara approves
    const reviewer = instructors.find((i) => i.role === 'DEMONSTRATOR')?.id || inst1.id;
    const approvedLeave = await reviewLeaveRequest(leaveReq.id, 'APPROVED', reviewer, 'Approved for health reason');
    assert(approvedLeave.status === 'APPROVED', 'Leave transitioned to APPROVED');

    // Attempt assigning duty to inst2 on leave date
    const assignOnLeave = await addDutyAssignment({
      rosterWeekId: week.id,
      instructorId: inst2.id,
      dutyDate: testDate,
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      dutyType: 'Teaching Duty',
      batchName: 'HDCN 23.2',
      moduleName: 'Networks',
    });
    assert(assignOnLeave.success === false, 'Scheduling on approved leave was blocked');

    // 4. Night Duty Allocation & Leave Conflict
    const nightShiftOnLeave = await setNightShift(week.id, testDate, inst2.id);
    assert(nightShiftOnLeave.success === false, 'Night duty assignment blocked for instructor on leave');

    const inst3 = instructors[2];
    const validNightShift = await setNightShift(week.id, testDate, inst3.id, 'Caretaker');
    createdNightShiftDates.push(testDate);
    assert(validNightShift.success === true, 'Night duty successfully assigned to available instructor');

    // 5. Dr. Thisara's Mathematical Free Pool Calculation
    // On testDate:
    // inst1 is on Duty (09:00-12:00)
    // inst2 is on Leave
    // inst3 has night duty (daytime is free)
    // inst4..inst9 (6 instructors) are not assigned to Morning slot
    // Total cadre = 9. In Morning slot: 1 On Duty, 1 On Leave => 7 Free Standby!
    const report = await getExecutiveStatus(testDate, 'Morning (09:00 - 12:00)');
    assert(report.onDuty.length === 1, `On duty count matches (Expected: 1, Found: ${report.onDuty.length})`);
    assert(report.onLeave.length === 1, `On leave count matches (Expected: 1, Found: ${report.onLeave.length})`);
    assert(report.freeStandby.length === 7, `Free standby count matches (Expected: 7, Found: ${report.freeStandby.length})`);
    assert(
      report.nightDutyInstructor?.id === inst3.id,
      `Night duty officer correctly identified (${report.nightDutyInstructor?.fullName})`
    );

    // 6. Verify Full-Day Session Logic & Unification
    const morningSample = {
      id: 'duty-m-1',
      rosterWeekId: week.id,
      instructorId: inst1.id,
      instructorName: inst1.fullName,
      dutyDate: testDate,
      slotLabel: 'Morning (09:00 - 12:00)',
      startTime: '09:00',
      endTime: '12:00',
      dutyType: 'Teaching Duty',
      batchName: 'DSE 24.1F',
      moduleName: 'Database Systems',
      roomLab: 'Lab 1',
      notes: 'Morning theory',
    };
    const afternoonSample = {
      id: 'duty-a-1',
      rosterWeekId: week.id,
      instructorId: inst1.id,
      instructorName: inst1.fullName,
      dutyDate: testDate,
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      dutyType: 'Teaching Duty',
      batchName: 'DSE 24.1F',
      moduleName: 'Database Systems',
      roomLab: 'Lab 1',
      notes: 'Afternoon practical',
    };

    assert(isSameSession(morningSample, afternoonSample) === true, 'isSameSession recognizes matching session');
    assert(
      getMatchingOppositeSlotDuty(morningSample, [morningSample, afternoonSample])?.id === 'duty-a-1',
      'getMatchingOppositeSlotDuty correctly pairs morning with afternoon'
    );

    const merged = mergeDutyAssignments([morningSample, afternoonSample]);
    assert(merged.length === 1, `mergeDutyAssignments reduces pair to single entry (length: ${merged.length})`);
    assert(
      merged[0].startTime === '09:00' && merged[0].endTime === '16:00',
      `Merged session time spans 09:00 - 16:00 (got: ${merged[0].startTime} - ${merged[0].endTime})`
    );
    assert(
      merged[0].slotLabel === 'Full Day (09:00 - 16:00)',
      `Merged slotLabel is Full Day (09:00 - 16:00)`
    );
    assert(
      merged[0].notes === 'Morning theory • Afternoon practical',
      `Combined notes preserved both session notes (got: ${merged[0].notes})`
    );

    // 7. Full-Day DB integration with getExecutiveStatus
    const assign2 = await addDutyAssignment({
      rosterWeekId: week.id,
      instructorId: inst1.id,
      dutyDate: testDate,
      slotLabel: 'Afternoon (13:00 - 16:00)',
      startTime: '13:00',
      endTime: '16:00',
      dutyType: 'Teaching Duty',
      batchName: 'DSE 24.1F',
      moduleName: 'Database Systems',
    });
    assert(assign2.success === true, 'Successfully allocated matching afternoon slot');

    const execReportAll = await getExecutiveStatus(testDate, 'ALL');
    const inst1Duties = execReportAll.onDuty.filter((d) => d.instructor.id === inst1.id);
    assert(
      inst1Duties.length === 1,
      `getExecutiveStatus(ALL) merges matching slots into single onDuty entry (count: ${inst1Duties.length})`
    );
    assert(
      inst1Duties[0]?.assignment.startTime === '09:00' && inst1Duties[0]?.assignment.endTime === '16:00',
      `Executive report presents unified 09:00 - 16:00 timing`
    );

    // 8. Cleanup surviving duty assignments
    if (assign1.assignment) {
      await deleteDutyAssignment(assign1.assignment.id);
    }
    if (assign2.assignment) {
      await deleteDutyAssignment(assign2.assignment.id);
    }
  } finally {
    // Leave requests, night shifts, and the audit trail entries generated by
    // the assertions above have no "undo" in the storage API (by design --
    // audit logs are meant to be immutable) so clean them up directly here.
    if (createdLeaveIds.length > 0) {
      await prisma.leaveRequest.deleteMany({ where: { id: { in: createdLeaveIds } } });
    }
    if (createdNightShiftDates.length > 0) {
      await prisma.nightShift.deleteMany({ where: { shiftDate: { in: createdNightShiftDates } } });
    }
    // This branch only ever holds fixture data from test runs, so it's safe
    // to sweep every audit entry these mutations could have produced.
    await prisma.auditLog.deleteMany({ where: { targetEntity: { in: ['DutyAssignment', 'LeaveRequest', 'NightShift'] } } });
    await prisma.$disconnect();
  }

  console.log(`\n====================================================`);
  console.log(`🎯 RESULTS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
