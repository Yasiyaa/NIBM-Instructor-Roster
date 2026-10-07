import { NextResponse } from 'next/server';
import {
  getOrCreateRosterWeek,
  getDutyAssignments,
  getNightShifts,
  getCatalog,
  getInstructors,
  getExecutiveStatus,
} from '@/lib/storage';
import { mergeDutyAssignments } from '@/lib/roster-utils';
import { format } from 'date-fns';

export async function GET(_request?: Request) {
  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const week = await getOrCreateRosterWeek();
    const [rawDuties, nightShifts, catalog, instructors, executiveReport] = await Promise.all([
      getDutyAssignments(week.id),
      getNightShifts(week.id),
      getCatalog(),
      getInstructors(),
      getExecutiveStatus(todayStr),
    ]);

    const mergedDuties = mergeDutyAssignments(rawDuties);

    return NextResponse.json({
      week,
      today: todayStr,
      executiveReport,
      duties: rawDuties,
      mergedDuties,
      nightShifts,
      catalog,
      instructors,
    });
  } catch (error) {
    console.error('Error fetching public status board:', error);
    return NextResponse.json({ error: 'Failed to load public status board' }, { status: 500 });
  }
}
