import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getDutyAssignments, getNightShifts } from '@/lib/storage';
import { DutyAssignment, NightShift, User } from '@/types';

// Subscription feeds must always reflect the live roster, so this route
// can never be statically prerendered.
export const dynamic = 'force-dynamic';

// Sri Lanka is a fixed UTC+5:30 offset with no DST, so wall-clock times
// can be converted to UTC with simple arithmetic (no VTIMEZONE needed).
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Night shifts only record a date, not hours, so campus overnight duty is
// modelled as an 18:00 -> 06:00(+1) block.
const NIGHT_SHIFT_START = '18:00';
const NIGHT_SHIFT_END = '06:00';

function toICSDateUTC(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - COLOMBO_OFFSET_MS;
  return new Date(utcMs).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function toICSTimestampUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// RFC 5545: lines longer than 75 octets must be folded with CRLF + a leading space.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n ');
}

function buildDutyEvent(a: DutyAssignment, dtstamp: string): string {
  const description = `${a.slotLabel}\nNIBM Instructor Roster`;
  return [
    'BEGIN:VEVENT',
    foldLine(`UID:duty-${a.id}@nibm-instructor-roster`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toICSDateUTC(a.dutyDate, a.startTime)}`,
    `DTEND:${toICSDateUTC(a.dutyDate, a.endTime)}`,
    foldLine(`SUMMARY:${escapeICSText(`${a.batchName} — ${a.moduleName}`)}`),
    ...(a.roomLab ? [foldLine(`LOCATION:${escapeICSText(a.roomLab)}`)] : []),
    foldLine(`DESCRIPTION:${escapeICSText(description)}`),
    'END:VEVENT',
  ].join('\r\n');
}

function buildNightShiftEvent(s: NightShift, dtstamp: string): string {
  return [
    'BEGIN:VEVENT',
    foldLine(`UID:night-${s.id}@nibm-instructor-roster`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toICSDateUTC(s.shiftDate, NIGHT_SHIFT_START)}`,
    `DTEND:${toICSDateUTC(addDays(s.shiftDate, 1), NIGHT_SHIFT_END)}`,
    'SUMMARY:🌙 Night Duty (Overnight Stay)',
    foldLine(`DESCRIPTION:${escapeICSText(s.notes || 'NIBM Night Duty / Caretaker Shift')}`),
    'END:VEVENT',
  ].join('\r\n');
}

function buildICS(instructor: User, dutyAssignments: DutyAssignment[], nightShifts: NightShift[]): string {
  const dtstamp = toICSTimestampUTC(new Date());
  const events = [
    ...dutyAssignments.map((a) => buildDutyEvent(a, dtstamp)),
    ...nightShifts.map((s) => buildNightShiftEvent(s, dtstamp)),
  ];

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NIBM School of Computing//Instructor Roster//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeICSText(`${instructor.fullName} — NIBM Duty Roster`)}`),
    'X-WR-TIMEZONE:Asia/Colombo',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ instructorId: string }> }
) {
  const { instructorId } = await params;
  const instructor = await getUserById(instructorId);

  if (!instructor) {
    return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
  }

  const allDuties = await getDutyAssignments();
  const allNightShifts = await getNightShifts();
  const dutyAssignments = allDuties.filter((a) => a.instructorId === instructorId);
  const nightShifts = allNightShifts.filter((s) => s.instructorId === instructorId);
  const ics = buildICS(instructor, dutyAssignments, nightShifts);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="nibm-roster-${instructorId}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
