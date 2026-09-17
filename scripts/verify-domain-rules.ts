import {
  addDutyAssignment,
  deleteDutyAssignment,
  createLeaveRequest,
  reviewLeaveRequest,
  setNightShift,
  getExecutiveStatus,
  getInstructors,
  getDutyAssignments,
} from '../src/lib/storage';

console.log('====================================================');
console.log('🧪 VERIFYING NIBM ROSTER SYSTEM DOMAIN LOGIC');
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

// 1. Verify Cadre Count
const instructors = getInstructors();
assert(instructors.length === 8, `Cadre count should be exactly 8 instructors (found: ${instructors.length})`);

// 2. Collision Rule: Double Booking Prevention
const testDate = `2030-05-${Math.floor(Math.random() * 20 + 10)}`; // Unique future test date
const inst1 = instructors[0];

const assign1 = addDutyAssignment({
  rosterWeekId: 'week-test',
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
const doubleBooking = addDutyAssignment({
  rosterWeekId: 'week-test',
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
const inst2 = instructors[1];
const leaveReq = createLeaveRequest(inst2.id, testDate, testDate, 'Doctor appointment');
assert(leaveReq.status === 'PENDING', 'Leave request created in PENDING state');

// Yasith / Dr. Thisara approves
const approvedLeave = reviewLeaveRequest(leaveReq.id, 'APPROVED', 'user-yasith', 'Approved for health reason');
assert(approvedLeave.status === 'APPROVED', 'Leave transitioned to APPROVED');

// Attempt assigning duty to inst2 on leave date
const assignOnLeave = addDutyAssignment({
  rosterWeekId: 'week-test',
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
const nightShiftOnLeave = setNightShift('week-test', testDate, inst2.id);
assert(nightShiftOnLeave.success === false, 'Night duty assignment blocked for instructor on leave');

const inst3 = instructors[2];
const validNightShift = setNightShift('week-test', testDate, inst3.id, 'Caretaker');
assert(validNightShift.success === true, 'Night duty successfully assigned to available instructor');

// 5. Dr. Thisara's Mathematical Free Pool Calculation
// On testDate:
// inst1 is on Duty (09:00-12:00)
// inst2 is on Leave
// inst3 has night duty (daytime is free)
// inst4..inst8 (5 instructors) are not assigned to Morning slot
// Total cadre = 8. In Morning slot: 1 On Duty, 1 On Leave => 6 Free Standby!
const report = getExecutiveStatus(testDate, 'Morning (09:00 - 12:00)');
assert(report.onDuty.length === 1, `On duty count matches (Expected: 1, Found: ${report.onDuty.length})`);
assert(report.onLeave.length === 1, `On leave count matches (Expected: 1, Found: ${report.onLeave.length})`);
assert(report.freeStandby.length === 6, `Free standby count matches (Expected: 6, Found: ${report.freeStandby.length})`);
assert(report.nightDutyInstructor?.id === inst3.id, `Night duty officer correctly identified (${report.nightDutyInstructor?.fullName})`);

// 6. Cleanup test assignment
if (assign1.assignment) {
  deleteDutyAssignment(assign1.assignment.id);
}

console.log(`\n====================================================`);
console.log(`🎯 RESULTS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
