import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getDutyAssignments, getNightShifts } from '@/lib/storage';
import { mergeDutyAssignments } from '@/lib/roster-utils';
import { DutyAssignment, NightShift, User } from '@/types';

// Subscription feeds must always reflect the live roster, so this route
// can never be statically prerendered.
export const dynamic = 'force-dynamic';

// Sri Lanka is a fixed UTC+5:30 offset with no DST, so wall-clock times
// can be converted to UTC with simple arithmetic (no VTIMEZONE needed).
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Night shifts do not have a fixed time or hours allocated, so they are
// exported as all-day date events (VALUE=DATE) spanning the duty date.
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
  const summary = a.batchName || a.moduleName ? `${a.batchName || ''} — ${a.moduleName || ''}` : a.dutyType;
  const description = [a.slotLabel, a.notes, 'NIBM Instructor Roster'].filter(Boolean).join('\n');
  return [
    'BEGIN:VEVENT',
    foldLine(`UID:duty-${a.id}@nibm-instructor-roster`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toICSDateUTC(a.dutyDate, a.startTime)}`,
    `DTEND:${toICSDateUTC(a.dutyDate, a.endTime)}`,
    foldLine(`SUMMARY:${escapeICSText(summary)}`),
    ...(a.roomLab ? [foldLine(`LOCATION:${escapeICSText(a.roomLab)}`)] : []),
    foldLine(`DESCRIPTION:${escapeICSText(description)}`),
    'END:VEVENT',
  ].join('\r\n');
}

function buildNightShiftEvent(s: NightShift, dtstamp: string): string {
  const dtStart = s.shiftDate.replace(/-/g, '');
  const dtEnd = addDays(s.shiftDate, 1).replace(/-/g, '');

  return [
    'BEGIN:VEVENT',
    foldLine(`UID:night-${s.id}@nibm-instructor-roster`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    'SUMMARY:🌙 Night Duty',
    foldLine(`DESCRIPTION:${escapeICSText(s.notes || 'NIBM Night Duty / Caretaker Shift')}`),
    'TRANSP:TRANSPARENT',
    'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE',
    'END:VEVENT',
  ].join('\r\n');
}

function buildICS(instructor: User, dutyAssignments: DutyAssignment[], nightShifts: NightShift[]): string {
  const dtstamp = toICSTimestampUTC(new Date());
  const mergedDuties = mergeDutyAssignments(dutyAssignments);
  const events = [
    ...mergedDuties.map((a) => buildDutyEvent(a, dtstamp)),
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
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
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
      'Content-Disposition': `inline; filename="nibm-roster-${instructorId}.ics"`,
      'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
