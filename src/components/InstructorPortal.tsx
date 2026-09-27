'use client';

import React, { useState } from 'react';
import { User, DutyAssignment, NightShift, LeaveRequest, RosterWeek } from '@/types';
import {
  Calendar,
  Clock,
  Moon,
  MapPin,
  Send,
  CheckCircle2,
  AlertCircle,
  Filter,
  UserCheck,
  Users,
  Phone,
  CalendarPlus,
  Link2,
  Download,
  Info,
} from 'lucide-react';
import { submitLeaveAction } from '@/lib/actions';
import { mergeDutyAssignments } from '@/lib/roster-utils';
import { useDialog } from './DialogProvider';

interface InstructorPortalProps {
  currentUser: User;
  allInstructors: User[];
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  rosterWeek: RosterWeek;
  onRefresh: () => void;
}

export const InstructorPortal: React.FC<InstructorPortalProps> = ({
  currentUser,
  allInstructors,
  dutyAssignments,
  nightShifts,
  leaveRequests,
  rosterWeek,
  onRefresh,
}) => {
  const { notify } = useDialog();
  // The "instructors" account is the one shared kiosk login used by
  // whoever's physically at the terminal; every other account here belongs
  // to one real person, so the header shouldn't call it a shared terminal.
  const isSharedKiosk = currentUser.username === 'instructors';
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'applyLeave' | 'teamLeaves'>('schedule');
  // Selected instructor filter for viewing tasks -- defaults to "just me"
  // for a real individual account, and the full roster for the shared kiosk.
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>(isSharedKiosk ? 'ALL' : currentUser.id);

  // Leave Form State -- filed strictly for the currently authenticated instructor
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedLinkCopied, setFeedLinkCopied] = useState(false);

  // Absolute .ics feed URL for the currently filtered instructor (Google Calendar
  // and webcal:// subscriptions both need a fully-qualified URL, not a relative path).
  const getCalendarFeedUrl = (instId: string): string | null => {
    if (typeof window === 'undefined') return null;
    return `${window.location.origin}/api/calendar/${instId}`;
  };

  const getGoogleCalendarSubscribeUrl = (instId: string): string | null => {
    const feedUrl = getCalendarFeedUrl(instId);
    if (!feedUrl) return null;
    return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
  };

  const getDownloadIcsUrl = (instId: string): string => {
    return `/api/calendar/${instId}`;
  };

  const handleCopyFeedLink = async (instId: string) => {
    const feedUrl = getCalendarFeedUrl(instId);
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl.replace(/^https?:\/\//, 'webcal://'));
      setFeedLinkCopied(true);
      setTimeout(() => setFeedLinkCopied(false), 2500);
    } catch {
      await notify('Could not copy link. Long-press the Subscribe button and copy the URL manually.');
    }
  };

  // 1-Click direct add to Google Calendar for a specific lecture/session
  const getGoogleCalendarEventUrl = (a: DutyAssignment): string => {
    const summary = a.batchName || a.moduleName ? `${a.batchName || ''} — ${a.moduleName || ''}` : a.dutyType;
    const details = [a.slotLabel, a.notes, 'NIBM Instructor Roster'].filter(Boolean).join('\n');
    const location = a.roomLab || '';

    // Sri Lanka is UTC+5:30 with no DST
    const toUTC = (dateStr: string, timeStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const utcMs = Date.UTC(year, month - 1, day, hour, minute) - 5.5 * 60 * 60 * 1000;
      return new Date(utcMs).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startUTC = toUTC(a.dutyDate, a.startTime);
    const endUTC = toUTC(a.dutyDate, a.endTime);

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      dates: `${startUTC}/${endUTC}`,
      details,
      location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // 1-Click direct add to Google Calendar for a night duty (All-day date event, no fixed time)
  const getGoogleCalendarNightShiftUrl = (shift: NightShift): string => {
    const summary = '🌙 Night Duty';
    const details = [shift.notes, 'NIBM Night Duty / Caretaker Shift', 'NIBM Instructor Roster'].filter(Boolean).join('\n');
    const startDateFormatted = shift.shiftDate.replace(/-/g, '');
    const d = new Date(`${shift.shiftDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const endDateFormatted = d.toISOString().split('T')[0].replace(/-/g, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      dates: `${startDateFormatted}/${endDateFormatted}`,
      details,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Filter assignments based on dropdown selection and merge full-day sessions (09:00 - 16:00)
  const filteredDuties = dutyAssignments.filter((a) => {
    if (selectedInstructorId === 'ALL') return true;
    return a.instructorId === selectedInstructorId;
  });
  const displayedAssignments = mergeDutyAssignments(filteredDuties).sort(
    (a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startTime.localeCompare(b.startTime)
  );

  // Filter night shifts
  const displayedNightShifts = nightShifts
    .filter((s) => {
      if (selectedInstructorId === 'ALL') return true;
      return s.instructorId === selectedInstructorId;
    })
    .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));

  // Filter leave history
  const displayedLeaves = leaveRequests.filter((l) => {
    if (selectedInstructorId === 'ALL') return true;
    return l.instructorId === selectedInstructorId;
  });

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      setErrorMessage('Please pick a start date');
      return;
    }
    const end = endDate || startDate;
    if (end < startDate) {
      setErrorMessage('End date cannot be earlier than start date');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Please state a reason for your leave');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitLeaveAction(currentUser.id, startDate, end, reason.trim());
      setSuccessMessage(
        `Holiday application submitted! It's now awaiting review in the Leave Approvals queue.`
      );
      setReason('');
      setStartDate('');
      setEndDate('');
      onRefresh();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch {
      setErrorMessage('Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: General Instructor Portal Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-purple-300 font-semibold uppercase tracking-wider">
                Instructors Cadre Portal
              </span>
              <h2 className="text-2xl font-black text-white">
                {isSharedKiosk ? 'General Instructor Workspace' : `Welcome, ${currentUser.fullName.split(' ')[0]}`}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {isSharedKiosk
                  ? 'Shared terminal for the 8 team members • Check assigned lectures, night shifts & apply for holiday'
                  : 'Check your assigned lectures, night shifts & apply for holiday'}
              </p>
            </div>
          </div>

          {/* Right: Unified Controls & Calendar Action Center */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2 sm:p-2.5 shadow-sm">
            {/* Instructor View Selector */}
            <div className="flex items-center space-x-2 px-1">
              <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-xs text-purple-300 font-bold whitespace-nowrap">Filter View:</span>
              <select
                value={selectedInstructorId}
                onChange={(e) => setSelectedInstructorId(e.target.value)}
                className="text-xs bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                <option value="ALL">All {allInstructors.length} Instructors (Full Cadre)</option>
                {allInstructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.fullName}
                  </option>
                ))}
              </select>
            </div>

            {selectedInstructorId !== 'ALL' && (
              <div className="hidden sm:block h-6 w-px bg-slate-700 shrink-0" />
            )}

            {/* Calendar Export Actions */}
            {selectedInstructorId !== 'ALL' ? (
              <div className="flex items-center gap-1.5 flex-nowrap">
                <a
                  href={getGoogleCalendarSubscribeUrl(selectedInstructorId) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                  title="Subscribe to entire live calendar in Google Calendar"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Google Calendar</span>
                </a>
                <a
                  href={getDownloadIcsUrl(selectedInstructorId)}
                  download={`nibm-roster-${selectedInstructorId}.ics`}
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  title="Download .ics file to import directly into Google Calendar, Outlook, or Apple Calendar"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>.ICS</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyFeedLink(selectedInstructorId)}
                  title="Copy the iCal feed link (for Apple Calendar / Outlook / webcal)"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl transition-colors cursor-pointer shrink-0 border ${
                    feedLinkCopied
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  {feedLinkCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                </button>

                {/* Google Calendar sync notice: hover-and-view tooltip */}
                <div className="relative group shrink-0">
                  <button
                    type="button"
                    title="Google Calendar sync information"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3.5 bg-slate-950/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md text-[11px] text-slate-300 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto">
                    <div className="flex items-center gap-1.5 font-bold text-white mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>Google Calendar Sync Notice</span>
                    </div>
                    <p className="leading-relaxed">
                      Google Calendar refreshes subscribed URL calendars automatically every 8–24 hours.
                    </p>
                    <p className="leading-relaxed mt-1 text-slate-400">
                      For an <span className="text-emerald-400 font-semibold">immediate update</span>, click <span className="font-semibold text-blue-300">+ Google Cal</span> / <span className="font-semibold text-blue-300">+ Cal</span> on any session below or use <span className="font-semibold text-slate-200">Download .ics</span> to import directly.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic px-2">
                Select an instructor to subscribe to calendar
              </span>
            )}
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 text-sm">
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
              activeSubTab === 'schedule'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            Assigned Tasks & Schedule
          </button>
          <button
            onClick={() => setActiveSubTab('applyLeave')}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
              activeSubTab === 'applyLeave'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            Apply for Holiday / Leave
          </button>
          <button
            onClick={() => setActiveSubTab('teamLeaves')}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
              activeSubTab === 'teamLeaves'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            Colleagues on Holiday
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ASSIGNED TASKS & SCHEDULE */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-6">
          {/* 7-Day Night Duty Roster Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">7-Day Night Duty Roster</h4>
                  <p className="text-xs text-slate-500">
                    Week of {rosterWeek.startDate} to {rosterWeek.endDate}
                  </p>
                </div>
              </div>
              <span className="text-[11px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg font-medium">
                Daily Rotation
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
              {displayedNightShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="bg-slate-800/60 border border-slate-800 rounded-xl p-2.5 text-center flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      {new Date(shift.shiftDate).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className="text-xs font-semibold text-indigo-400 block mt-0.5 truncate">
                      {shift.instructorName}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {shift.shiftDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1.5 flex-wrap">
                    {shift.instructorPhone && shift.instructorId !== currentUser.id && (
                      <a
                        href={`tel:${shift.instructorPhone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-900 px-2 py-0.5 rounded font-medium cursor-pointer transition-colors"
                        title={`Call ${shift.instructorName}`}
                      >
                        <Phone className="w-2.5 h-2.5" />
                        <span>Call</span>
                      </a>
                    )}
                    {shift.instructorId === currentUser.id && (
                      <a
                        href={getGoogleCalendarNightShiftUrl(shift)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 hover:text-white bg-blue-600/30 hover:bg-blue-600 border border-blue-500/30 px-1.5 py-0.5 rounded transition-all shadow-xs cursor-pointer"
                        title="Add Night Duty to Google Calendar (All-day, no fixed time)"
                      >
                        <CalendarPlus className="w-2.5 h-2.5" />
                        <span>+ Cal</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Teaching Sessions */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-100 text-base">
                  Teaching Duties & Lab Sessions ({displayedAssignments.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {selectedInstructorId === 'ALL' ? 'Showing entire team' : 'Filtered to selected instructor'}
              </span>
            </div>

            {displayedAssignments.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-sm">No teaching slots match the current filter.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Yasith plans sessions every Sunday.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 hover:border-purple-500/20 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {new Date(a.dutyDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            a.startTime === '09:00' && a.endTime === '16:00'
                              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30'
                              : 'bg-purple-500/15 text-purple-400'
                          }`}
                        >
                          {a.startTime === '09:00' && a.endTime === '16:00'
                            ? '09:00 - 16:00 (Full Day)'
                            : `${a.startTime} - ${a.endTime}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-100">
                          <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>{a.instructorName}</span>
                        </div>
                        {a.instructorPhone && a.instructorId !== currentUser.id && (
                          <a
                            href={`tel:${a.instructorPhone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                            title={`Call ${a.instructorName}`}
                          >
                            <Phone className="w-2.5 h-2.5" />
                            <span>Call</span>
                          </a>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-200 text-sm">{a.moduleName ?? a.dutyType}</h4>
                      {a.notes && <p className="text-xs text-slate-400 italic mt-1">{a.notes}</p>}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-4 pt-2.5 border-t border-slate-800 gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {a.batchName && (
                          <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                            Batch: {a.batchName}
                          </span>
                        )}
                        {a.roomLab && (
                          <span className="flex items-center space-x-1 text-slate-500 font-medium text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{a.roomLab}</span>
                          </span>
                        )}
                      </div>
                      <a
                        href={getGoogleCalendarEventUrl(a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Instantly add this session to your personal Google Calendar"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        <span>+ Google Cal</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: APPLY FOR HOLIDAY / LEAVE */}
      {activeSubTab === 'applyLeave' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application Form */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-6">
            <h3 className="font-bold text-slate-100 text-base mb-1">
              Apply for Holiday / Leave
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Enter your leave request dates and reason. It will appear in the Leave Approvals queue for the
              Demonstrator, Executive, or Admin to review.
            </p>

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4">
              {/* Applicant Name: Strictly locked to authenticated caller */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Applicant (Your Account)
                </label>
                <div className="w-full text-sm bg-slate-950/80 border border-slate-700 text-slate-100 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{currentUser.fullName}</span>
                    <span className="text-xs text-slate-400">(@{currentUser.username})</span>
                  </div>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-medium border border-purple-500/30">
                    Self-Service Only
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-sm border border-slate-700 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    End Date (Leave blank if 1-day)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-sm border border-slate-700 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Reason for Holiday / Leave
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. University exam duty, medical leave, family event, personal emergency"
                  className="w-full text-sm border border-slate-700 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Holiday Application'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Leave History / Status Log */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-6 flex flex-col">
            <h4 className="font-bold text-slate-100 text-sm mb-3">
              Submitted Holiday Requests
            </h4>

            <div className="space-y-3 overflow-y-auto max-h-[380px] flex-1">
              {displayedLeaves.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No leave requests logged yet.
                </div>
              ) : (
                displayedLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="bg-slate-800/60 border border-slate-800 rounded-xl p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-100">{leave.instructorName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          leave.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : leave.status === 'REJECTED'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {leave.startDate} {leave.startDate !== leave.endDate && `to ${leave.endDate}`}
                    </div>
                    <p className="text-slate-400 italic mt-1">&ldquo;{leave.reason}&rdquo;</p>
                    {leave.reviewedByName && (
                      <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-800">
                        Reviewed by <strong>{leave.reviewedByName}</strong>: &ldquo;{leave.reviewComment}&rdquo;
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: COLLEAGUES ON HOLIDAY */}
      {activeSubTab === 'teamLeaves' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-100 text-base">
              Approved Absence Transparency Board
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Review who is scheduled away to ensure adequate laboratory coverage before applying for leave.
          </p>

          {leaveRequests.filter((l) => l.status === 'APPROVED').length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No instructors currently on approved leave. Full team capacity available!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {leaveRequests
                .filter((l) => l.status === 'APPROVED')
                .map((leave) => (
                  <div
                    key={leave.id}
                    className="bg-slate-800/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <h5 className="font-bold text-slate-100 text-sm">{leave.instructorName}</h5>
                      <p className="text-xs text-slate-500">
                        Off on: <strong>{leave.startDate}</strong> {leave.startDate !== leave.endDate && `to ${leave.endDate}`}
                      </p>
                      <p className="text-[11px] text-slate-400 italic mt-0.5">&ldquo;{leave.reason}&rdquo;</p>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full uppercase">
                      On Leave
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
