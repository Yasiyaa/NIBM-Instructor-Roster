import { DutyAssignment } from '@/types';

/**
 * Checks if two duty assignments represent the same session
 * (same instructor, date, batch, module, and duty type).
 */
export function isSameSession(a: DutyAssignment, b: DutyAssignment): boolean {
  return (
    a.instructorId === b.instructorId &&
    a.dutyDate === b.dutyDate &&
    (a.batchName ?? '') === (b.batchName ?? '') &&
    (a.moduleName ?? '') === (b.moduleName ?? '') &&
    a.dutyType === b.dutyType
  );
}

/**
 * Finds the matching opposite slot duty (Morning <-> Afternoon) for the same session.
 */
export function getMatchingOppositeSlotDuty(
  duty: DutyAssignment,
  allDuties: DutyAssignment[]
): DutyAssignment | undefined {
  if (duty.startTime !== '09:00' && duty.startTime !== '13:00') return undefined;
  const targetStartTime = duty.startTime === '09:00' ? '13:00' : '09:00';

  return allDuties.find(
    (other) =>
      other.id !== duty.id &&
      other.startTime === targetStartTime &&
      isSameSession(duty, other)
  );
}

/**
 * Merges same-day morning (09:00 - 12:00) and afternoon (13:00 - 16:00) duties
 * that belong to the same session into a single unified full-day entry ("09:00 - 16:00").
 */
export function mergeDutyAssignments(assignments: DutyAssignment[]): DutyAssignment[] {
  const result: DutyAssignment[] = [];
  const handledIds = new Set<string>();

  for (let i = 0; i < assignments.length; i++) {
    const current = assignments[i];
    if (handledIds.has(current.id)) continue;

    if (current.startTime === '09:00') {
      const matchingAfternoon = assignments.find(
        (other) =>
          !handledIds.has(other.id) &&
          other.id !== current.id &&
          other.startTime === '13:00' &&
          isSameSession(current, other)
      );

      if (matchingAfternoon) {
        handledIds.add(current.id);
        handledIds.add(matchingAfternoon.id);

        const combinedNotes = Array.from(
          new Set([current.notes, matchingAfternoon.notes].filter(Boolean))
        ).join(' • ') || undefined;

        result.push({
          ...current,
          startTime: '09:00',
          endTime: '16:00',
          slotLabel: 'Full Day (09:00 - 16:00)',
          roomLab: current.roomLab || matchingAfternoon.roomLab,
          notes: combinedNotes,
        });
        continue;
      }
    }

    if (current.startTime === '13:00') {
      const matchingMorning = assignments.find(
        (other) =>
          !handledIds.has(other.id) &&
          other.id !== current.id &&
          other.startTime === '09:00' &&
          isSameSession(current, other)
      );

      if (matchingMorning) {
        handledIds.add(current.id);
        handledIds.add(matchingMorning.id);

        const combinedNotes = Array.from(
          new Set([matchingMorning.notes, current.notes].filter(Boolean))
        ).join(' • ') || undefined;

        result.push({
          ...matchingMorning,
          startTime: '09:00',
          endTime: '16:00',
          slotLabel: 'Full Day (09:00 - 16:00)',
          roomLab: matchingMorning.roomLab || current.roomLab,
          notes: combinedNotes,
        });
        continue;
      }
    }

    handledIds.add(current.id);
    result.push(current);
  }

  return result;
}

/**
 * Formats an ISO timestamp into a user-friendly date and time string
 * (e.g. "Oct 1, 2026, 09:55 AM").
 */
export function formatApplicationDateTime(isoStr?: string): string {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}
