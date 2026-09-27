import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
  AcademicCatalog,
  AiProposedDuty,
  AiConflictReport,
  AiSubstituteSuggestion,
} from '@/types';

/**
 * Scan a roster week for conflicts, unassigned time blocks, unstaffed night duties,
 * and instructor workload variance.
 */
export function scanRosterHealth(params: {
  rosterWeek: RosterWeek;
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  allInstructors: User[];
}): AiConflictReport {
  const { rosterWeek, allInstructors } = params;
  const dutyAssignments = (params.dutyAssignments || []).filter((d): d is DutyAssignment => Boolean(d && d.dutyDate));
  const nightShifts = (params.nightShifts || []).filter((s): s is NightShift => Boolean(s && s.shiftDate));
  const leaveRequests = (params.leaveRequests || []).filter((l): l is LeaveRequest => Boolean(l && l.startDate));

  // Generate 7-day array
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(rosterWeek.startDate);
    d.setDate(d.getDate() + i);
    weekDays.push(d.toISOString().split('T')[0]);
  }

  const conflicts: AiConflictReport['conflicts'] = [];
  const recommendations: string[] = [];
  let unassignedSlotsCount = 0;
  let unassignedNightShiftsCount = 0;

  // 1. Detect Double-Bookings
  const slotMap = new Map<string, DutyAssignment[]>();
  for (const duty of dutyAssignments) {
    const key = `${duty.dutyDate}-${duty.startTime}-${duty.instructorId}`;
    const list = slotMap.get(key) || [];
    list.push(duty);
    slotMap.set(key, list);
  }

  for (const list of slotMap.values()) {
    if (list.length > 1) {
      const first = list[0];
      const inst = allInstructors.find((u) => u.id === first.instructorId);
      conflicts.push({
        type: 'DOUBLE_BOOKING',
        description: `Double-booking detected for ${inst?.fullName || 'instructor'} on ${first.dutyDate} at ${first.startTime}`,
        date: first.dutyDate,
        slot: first.slotLabel,
        instructorName: inst?.fullName,
      });
      recommendations.push(
        `Resolve clash on ${first.dutyDate}: ${inst?.fullName} is booked for multiple sessions at ${first.startTime}.`
      );
    }
  }

  // 2. Detect Leave Precedence Violations
  for (const leave of leaveRequests) {
    if (leave.status !== 'APPROVED') continue;
    const inst = allInstructors.find((u) => u.id === leave.instructorId);

    // Check duty conflicts
    for (const duty of dutyAssignments) {
      if (!duty) continue;
      if (
        duty.instructorId === leave.instructorId &&
        duty.dutyDate >= leave.startDate &&
        duty.dutyDate <= leave.endDate
      ) {
        conflicts.push({
          type: 'LEAVE_COLLISION',
          description: `${inst?.fullName || 'Instructor'} is scheduled for duty on ${duty.dutyDate} while on approved leave (${leave.reason})`,
          date: duty.dutyDate,
          slot: duty.slotLabel,
          instructorName: inst?.fullName,
        });
        recommendations.push(
          `Reassign duty on ${duty.dutyDate}: ${inst?.fullName} is on approved holiday.`
        );
      }
    }

    // Check night shift conflicts
    for (const shift of nightShifts) {
      if (!shift) continue;
      if (
        shift.instructorId === leave.instructorId &&
        shift.shiftDate >= leave.startDate &&
        shift.shiftDate <= leave.endDate
      ) {
        conflicts.push({
          type: 'LEAVE_COLLISION',
          description: `${inst?.fullName || 'Instructor'} is assigned night duty on ${shift.shiftDate} while on approved leave`,
          date: shift.shiftDate,
          instructorName: inst?.fullName,
        });
        recommendations.push(
          `Reassign overnight shift on ${shift.shiftDate}: ${inst?.fullName} is away.`
        );
      }
    }
  }

  // 3. Detect Unassigned Slots and Night Shifts
  for (const dateStr of weekDays) {
    const d = new Date(dateStr);
    const isSunday = d.getDay() === 0;

    const morningCount = dutyAssignments.filter(
      (a) => a.dutyDate === dateStr && (a.startTime === '09:00' || a.slotLabel.includes('Morning'))
    ).length;
    const afternoonCount = dutyAssignments.filter(
      (a) => a.dutyDate === dateStr && (a.startTime === '13:00' || a.slotLabel.includes('Afternoon'))
    ).length;

    if (morningCount === 0) unassignedSlotsCount++;
    if (afternoonCount === 0) unassignedSlotsCount++;

    if (isSunday) {
      const ccsCount = dutyAssignments.filter(
        (a) => a.dutyDate === dateStr && (a.startTime === '16:30' || a.slotLabel.includes('CCS'))
      ).length;
      if (ccsCount === 0) unassignedSlotsCount++;
    }

    const hasNight = nightShifts.some((s) => s.shiftDate === dateStr);
    if (!hasNight) {
      unassignedNightShiftsCount++;
      conflicts.push({
        type: 'UNSTAFFED_NIGHT',
        description: `No night shift officer designated for ${dateStr}`,
        date: dateStr,
      });
      recommendations.push(`Assign an overnight caretaker for ${dateStr}.`);
    }
  }

  // 4. Calculate Workload Imbalances
  const cadre = allInstructors.filter((u) => u.isActive && u.username !== 'instructors');
  const instructorHours = new Map<string, { count: number; hours: number }>();

  for (const inst of cadre) {
    instructorHours.set(inst.id, { count: 0, hours: 0 });
  }

  for (const duty of dutyAssignments) {
    const entry = instructorHours.get(duty.instructorId);
    if (entry) {
      entry.count += 1;
      const h = duty.startTime === '16:30' ? 1 : 3;
      entry.hours += h;
    }
  }

  const totalTeachingHours = Array.from(instructorHours.values()).reduce((sum, v) => sum + v.hours, 0);
  const avgHours = cadre.length > 0 ? totalTeachingHours / cadre.length : 0;

  const workloadImbalances: AiConflictReport['workloadImbalances'] = [];
  for (const inst of cadre) {
    const stats = instructorHours.get(inst.id) || { count: 0, hours: 0 };
    let status: 'OVERLOAD' | 'BALANCED' | 'UNDERLOAD' = 'BALANCED';

    if (stats.hours > avgHours + 6) {
      status = 'OVERLOAD';
      recommendations.push(
        `High workload: ${inst.fullName} has ${stats.hours}h scheduled (average is ${Math.round(avgHours)}h).`
      );
    } else if (stats.hours < avgHours - 6 && avgHours >= 6) {
      status = 'UNDERLOAD';
      recommendations.push(
        `Under-allocated: ${inst.fullName} has only ${stats.hours}h scheduled. Consider assigning upcoming lectures.`
      );
    }

    workloadImbalances.push({
      instructorId: inst.id,
      instructorName: inst.fullName,
      sessionCount: stats.count,
      teachingHours: stats.hours,
      status,
    });
  }

  if (unassignedSlotsCount > 0) {
    recommendations.unshift(
      `There are ${unassignedSlotsCount} lecture slots without assignments across the week.`
    );
  }

  return {
    unassignedSlotsCount,
    unassignedNightShiftsCount,
    workloadImbalances,
    conflicts,
    recommendations: Array.from(new Set(recommendations)).slice(0, 6),
  };
}

/**
 * Find and rank eligible substitute instructors for emergency coverage or leave coverage.
 */
export function findEligibleSubstitutes(params: {
  dateStr: string;
  startTime: string;
  absentInstructorId: string;
  allInstructors: User[];
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
}): AiSubstituteSuggestion[] {
  const {
    dateStr,
    startTime,
    absentInstructorId,
    allInstructors,
  } = params;
  const dutyAssignments = (params.dutyAssignments || []).filter((d): d is DutyAssignment => Boolean(d && d.dutyDate));
  const nightShifts = (params.nightShifts || []).filter((s): s is NightShift => Boolean(s && s.shiftDate));
  const leaveRequests = (params.leaveRequests || []).filter((l): l is LeaveRequest => Boolean(l && l.startDate));

  // Eligible cadre
  const cadre = allInstructors.filter(
    (u) => u.id !== absentInstructorId && u.isActive && u.username !== 'instructors'
  );

  // Compute current weekly teaching hours for all instructors
  const weeklyHoursMap = new Map<string, number>();
  for (const duty of dutyAssignments) {
    const prev = weeklyHoursMap.get(duty.instructorId) || 0;
    const h = duty.startTime === '16:30' ? 1 : 3;
    weeklyHoursMap.set(duty.instructorId, prev + h);
  }

  const suggestions: AiSubstituteSuggestion[] = [];

  for (const inst of cadre) {
    // 1. Check if instructor is on approved leave on this date
    const isOnLeave = leaveRequests.some(
      (l) =>
        l.instructorId === inst.id &&
        l.status === 'APPROVED' &&
        dateStr >= l.startDate &&
        dateStr <= l.endDate
    );

    if (isOnLeave) continue;

    // 2. Check if instructor already has duty at this time slot
    const isBusyAtSlot = dutyAssignments.some(
      (d) => d.instructorId === inst.id && d.dutyDate === dateStr && d.startTime === startTime
    );

    if (isBusyAtSlot) continue;

    // 3. Check night duty on this date
    const isNightShiftOfficer = nightShifts.some(
      (s) => s.instructorId === inst.id && s.shiftDate === dateStr
    );

    const currentHours = weeklyHoursMap.get(inst.id) || 0;

    // Suitability score calculation (0 - 100):
    // Prioritize instructors with lowest current load
    let score = Math.max(10, 100 - currentHours * 5);
    if (isNightShiftOfficer) {
      score = Math.max(10, score - 20); // slightly penalize if they also have night duty
    }

    let matchReason = `Free at ${startTime}. Currently has ${currentHours}h assigned this week.`;
    if (currentHours === 0) {
      matchReason = `Prime Standby: 0h assigned this week. Fully available with no schedule conflicts.`;
    } else if (isNightShiftOfficer) {
      matchReason = `Available for day slot (${currentHours}h total), but has Night Duty tonight.`;
    }

    suggestions.push({
      instructor: inst,
      currentWeeklyHours: currentHours,
      isAvailable: true,
      score,
      matchReason,
    });
  }

  // Sort by highest suitability score
  return suggestions.sort((a, b) => b.score - a.score);
}

/**
 * Deterministic Heuristic CSP Scheduler:
 * Generates collision-free, balanced draft assignments across unassigned slots.
 */
export function runDeterministicScheduler(params: {
  rosterWeek: RosterWeek;
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  allInstructors: User[];
  catalog: AcademicCatalog;
  targetDate?: string;
}): AiProposedDuty[] {
  const {
    rosterWeek,
    allInstructors,
    catalog,
    targetDate,
  } = params;
  const dutyAssignments = (params.dutyAssignments || []).filter((d): d is DutyAssignment => Boolean(d && d.dutyDate));
  const nightShifts = (params.nightShifts || []).filter((s): s is NightShift => Boolean(s && s.shiftDate));
  const leaveRequests = (params.leaveRequests || []).filter((l): l is LeaveRequest => Boolean(l && l.startDate));

  const cadre = allInstructors.filter((u) => u.isActive && u.username !== 'instructors');
  if (cadre.length === 0) return [];

  // Generate 7 days
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(rosterWeek.startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    if (!targetDate || targetDate === dateStr) {
      weekDays.push(dateStr);
    }
  }

  // Track running workload hours
  const workloadMap = new Map<string, number>();
  for (const inst of cadre) {
    workloadMap.set(inst.id, 0);
  }
  for (const duty of dutyAssignments) {
    const h = duty.startTime === '16:30' ? 1 : 3;
    workloadMap.set(duty.instructorId, (workloadMap.get(duty.instructorId) || 0) + h);
  }

  // Track running night shifts
  const nightCountMap = new Map<string, number>();
  for (const inst of cadre) {
    nightCountMap.set(inst.id, 0);
  }
  for (const s of nightShifts) {
    nightCountMap.set(s.instructorId, (nightCountMap.get(s.instructorId) || 0) + 1);
  }

  const proposed: AiProposedDuty[] = [];

  // Academic catalog defaults
  const batches = catalog.batches.length > 0 ? catalog.batches : ['DSE 24.1F', 'DSE 24.2F', 'HDSE 23.2'];
  const modules = catalog.modules.length > 0 ? catalog.modules : ['Software Engineering', 'Database Systems', 'Object Oriented Programming'];
  const rooms = catalog.rooms.length > 0 ? catalog.rooms : ['Lab 02', 'Lab 03', 'Hardware Lab'];

  let batchIdx = 0;

  for (const dateStr of weekDays) {
    const d = new Date(dateStr);
    const isSunday = d.getDay() === 0;

    // Helper: find best available instructor for this slot
    const getBestAvailableInstructor = (time: string): User | null => {
      const candidates = cadre.filter((inst) => {
        // Not on leave
        const onLeave = leaveRequests.some(
          (l) =>
            l.instructorId === inst.id &&
            l.status === 'APPROVED' &&
            dateStr >= l.startDate &&
            dateStr <= l.endDate
        );
        if (onLeave) return false;

        // Not already assigned in this slot (in existing or proposed)
        const alreadyTeaching =
          dutyAssignments.some(
            (a) => a.instructorId === inst.id && a.dutyDate === dateStr && a.startTime === time
          ) ||
          proposed.some(
            (p) => p.instructorId === inst.id && p.dutyDate === dateStr && p.startTime === time
          );
        if (alreadyTeaching) return false;

        return true;
      });

      if (candidates.length === 0) return null;

      // Sort by lowest running load
      candidates.sort((a, b) => (workloadMap.get(a.id) || 0) - (workloadMap.get(b.id) || 0));
      return candidates[0];
    };

    // 1. Morning Slot (09:00 - 12:00)
    const existingMorning = dutyAssignments.filter(
      (a) => a.dutyDate === dateStr && a.startTime === '09:00'
    );
    if (existingMorning.length === 0) {
      const inst = getBestAvailableInstructor('09:00');
      if (inst) {
        const batch = batches[batchIdx % batches.length];
        const selectedModule = modules[batchIdx % modules.length];
        const room = rooms[batchIdx % rooms.length];
        batchIdx++;

        proposed.push({
          id: `ai-morn-${dateStr}`,
          action: 'CREATE',
          dutyDate: dateStr,
          slotLabel: 'Morning (09:00 - 12:00)',
          startTime: '09:00',
          endTime: '12:00',
          instructorId: inst.id,
          instructorName: inst.fullName,
          dutyType: 'Teaching Duty',
          batchName: batch,
          moduleName: selectedModule,
          roomLab: room,
          notes: 'Auto-allocated by AI Co-Pilot for curriculum coverage',
          reason: `Lowest current weekly workload (${workloadMap.get(inst.id) || 0}h) & fully available.`,
        });

        workloadMap.set(inst.id, (workloadMap.get(inst.id) || 0) + 3);
      }
    }

    // 2. Afternoon Slot (13:00 - 16:00)
    const existingAfternoon = dutyAssignments.filter(
      (a) => a.dutyDate === dateStr && a.startTime === '13:00'
    );
    if (existingAfternoon.length === 0) {
      const inst = getBestAvailableInstructor('13:00');
      if (inst) {
        const batch = batches[batchIdx % batches.length];
        const selectedModule = modules[batchIdx % modules.length];
        const room = rooms[batchIdx % rooms.length];
        batchIdx++;

        proposed.push({
          id: `ai-aft-${dateStr}`,
          action: 'CREATE',
          dutyDate: dateStr,
          slotLabel: 'Afternoon (13:00 - 16:00)',
          startTime: '13:00',
          endTime: '16:00',
          instructorId: inst.id,
          instructorName: inst.fullName,
          dutyType: 'Teaching Duty',
          batchName: batch,
          moduleName: selectedModule,
          roomLab: room,
          notes: 'Auto-allocated by AI Co-Pilot for curriculum coverage',
          reason: `Balanced distribution among cadre (${workloadMap.get(inst.id) || 0}h currently).`,
        });

        workloadMap.set(inst.id, (workloadMap.get(inst.id) || 0) + 3);
      }
    }

    // 3. Sunday CCS (16:30 - 17:30)
    if (isSunday) {
      const existingCcs = dutyAssignments.filter(
        (a) => a.dutyDate === dateStr && a.startTime === '16:30'
      );
      if (existingCcs.length === 0) {
        const inst = getBestAvailableInstructor('16:30');
        if (inst) {
          proposed.push({
            id: `ai-ccs-${dateStr}`,
            action: 'CREATE',
            dutyDate: dateStr,
            slotLabel: 'Sunday CCS (16:30 - 17:30)',
            startTime: '16:30',
            endTime: '17:30',
            instructorId: inst.id,
            instructorName: inst.fullName,
            dutyType: 'Teaching Duty',
            batchName: 'CCS',
            moduleName: 'Continuous Curriculum Session',
            roomLab: 'Main Auditorium',
            notes: 'Sunday CCS Evening Session',
            reason: `Designated Sunday facilitator with lowest cumulative duty load.`,
          });

          workloadMap.set(inst.id, (workloadMap.get(inst.id) || 0) + 1);
        }
      }
    }

    // 4. Night Shift Coverage
    const existingNight = nightShifts.find((s) => s.shiftDate === dateStr);
    if (!existingNight) {
      // Find candidate with lowest night shifts & not on leave
      const nightCandidates = cadre.filter((inst) => {
        return !leaveRequests.some(
          (l) =>
            l.instructorId === inst.id &&
            l.status === 'APPROVED' &&
            dateStr >= l.startDate &&
            dateStr <= l.endDate
        );
      });

      if (nightCandidates.length > 0) {
        nightCandidates.sort((a, b) => (nightCountMap.get(a.id) || 0) - (nightCountMap.get(b.id) || 0));
        const nightOfficer = nightCandidates[0];

        proposed.push({
          id: `ai-night-${dateStr}`,
          action: 'CREATE',
          dutyDate: dateStr,
          slotLabel: 'Night Shift (Overnight Caretaker)',
          startTime: '18:00',
          endTime: '08:00',
          instructorId: nightOfficer.id,
          instructorName: nightOfficer.fullName,
          dutyType: 'Night Shift',
          notes: 'Overnight campus care & lab security monitoring',
          reason: `Assigned for fair rotation (${nightCountMap.get(nightOfficer.id) || 0} nights so far).`,
        });

        nightCountMap.set(nightOfficer.id, (nightCountMap.get(nightOfficer.id) || 0) + 1);
      }
    }
  }

  return proposed;
}

/**
 * Validate that proposed AI actions strictly respect domain invariants:
 * - No double-bookings
 * - No duties on approved leave
 */
export function validateProposedChanges(params: {
  proposed: AiProposedDuty[];
  existingDuties: DutyAssignment[];
  leaveRequests: LeaveRequest[];
}): AiProposedDuty[] {
  const { proposed, existingDuties, leaveRequests } = params;

  return proposed.filter((item) => {
    // 1. Check leave collision
    const onLeave = leaveRequests.some(
      (l) =>
        l.instructorId === item.instructorId &&
        l.status === 'APPROVED' &&
        item.dutyDate >= l.startDate &&
        item.dutyDate <= l.endDate
    );
    if (onLeave) return false;

    // 2. Check collision against existing duties (for non-night-shifts)
    if (item.dutyType !== 'Night Shift') {
      const clash = existingDuties.some(
        (e) =>
          e.instructorId === item.instructorId &&
          e.dutyDate === item.dutyDate &&
          e.startTime === item.startTime
      );
      if (clash) return false;
    }

    return true;
  });
}

/**
 * Hybrid Entrypoint:
 * Runs Gemini AI if GEMINI_API_KEY is present; otherwise seamlessly
 * activates the deterministic heuristic solver with zero-config fallback.
 */
export async function generateAiSchedule(params: {
  rosterWeek: RosterWeek;
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  allInstructors: User[];
  catalog: AcademicCatalog;
  prompt?: string;
  targetDate?: string;
}): Promise<AiProposedDuty[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  // If no Gemini API key, use deterministic solver directly
  if (!apiKey || apiKey.trim() === '') {
    const raw = runDeterministicScheduler(params);
    return validateProposedChanges({
      proposed: raw,
      existingDuties: params.dutyAssignments,
      leaveRequests: params.leaveRequests,
    });
  }

  // Attempt Gemini API call with structured prompt
  try {
    const activeInstructors = params.allInstructors
      .filter((u) => u.isActive && u.username !== 'instructors')
      .map((u) => ({ id: u.id, fullName: u.fullName }));

    const currentDuties = params.dutyAssignments.map((d) => ({
      date: d.dutyDate,
      time: d.startTime,
      instructorId: d.instructorId,
      instructorName: d.instructorName,
      module: d.moduleName,
    }));

    const activeLeaves = params.leaveRequests
      .filter((l) => l.status === 'APPROVED')
      .map((l) => ({ instructorId: l.instructorId, start: l.startDate, end: l.endDate }));

    const systemPrompt = `You are the AI Academic Scheduling Engine for NIBM School of Computing.
Generate or adjust duty assignments strictly following these invariants:
1. NEVER double-book an instructor at the same date and startTime.
2. NEVER schedule an instructor who is on approved leave.
3. Balance teaching hours equally across all available instructors.
4. Slot times: Morning is 09:00 - 12:00, Afternoon is 13:00 - 16:00, Sunday CCS is 16:30 - 17:30.
5. Night Duty runs overnight (18:00 - 08:00) with dutyType: "Night Shift".
Available Instructors: ${JSON.stringify(activeInstructors)}
Catalog Batches: ${JSON.stringify(params.catalog.batches)}
Catalog Modules: ${JSON.stringify(params.catalog.modules)}
Catalog Rooms: ${JSON.stringify(params.catalog.rooms)}
Current Duties: ${JSON.stringify(currentDuties)}
Approved Leaves: ${JSON.stringify(activeLeaves)}
User Request: ${params.prompt || 'Auto-fill unassigned slots with balanced hours'}
Week Start: ${params.rosterWeek.startDate}, End: ${params.rosterWeek.endDate}
Return a JSON array of objects conforming to:
[
  {
    "id": "string",
    "action": "CREATE",
    "dutyDate": "YYYY-MM-DD",
    "slotLabel": "Morning (09:00 - 12:00)" | "Afternoon (13:00 - 16:00)" | "Sunday CCS (16:30 - 17:30)" | "Night Shift",
    "startTime": "09:00" | "13:00" | "16:30" | "18:00",
    "endTime": "12:00" | "16:00" | "17:30" | "08:00",
    "instructorId": "string",
    "instructorName": "string",
    "dutyType": "Teaching Duty" | "Night Shift",
    "batchName": "string",
    "moduleName": "string",
    "roomLab": "string",
    "notes": "string",
    "reason": "string"
  }
]`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn(`Gemini API error ${res.status}, falling back to deterministic solver.`);
      const raw = runDeterministicScheduler(params);
      return validateProposedChanges({
        proposed: raw,
        existingDuties: params.dutyAssignments,
        leaveRequests: params.leaveRequests,
      });
    }

    const data = await res.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (jsonText) {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        return validateProposedChanges({
          proposed: parsed,
          existingDuties: params.dutyAssignments,
          leaveRequests: params.leaveRequests,
        });
      }
    }
  } catch (err) {
    console.warn('Gemini scheduler call failed, using deterministic fallback:', err);
  }

  // Fallback to deterministic CSP solver
  const raw = runDeterministicScheduler(params);
  return validateProposedChanges({
    proposed: raw,
    existingDuties: params.dutyAssignments,
    leaveRequests: params.leaveRequests,
  });
}
