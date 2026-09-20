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
} from 'lucide-react';
import { submitLeaveAction } from '@/lib/actions';
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

  // Leave Form State -- pre-filled with the signed-in instructor's own name
  // so they don't have to find themselves in the list every time; the
  // shared kiosk account still starts blank since it applies on anyone's
  // behalf.
  const [applicantId, setApplicantId] = useState<string>(isSharedKiosk ? '' : currentUser.id);
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
    const webcalUrl = feedUrl.replace(/^https?:\/\//, 'webcal://');
    return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
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

  // Filter assignments based on dropdown selection
  const displayedAssignments = dutyAssignments
    .filter((a) => {
      if (selectedInstructorId === 'ALL') return true;
      return a.instructorId === selectedInstructorId;
    })
    .sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startTime.localeCompare(b.startTime));

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
    if (!applicantId) {
      setErrorMessage('Please select which instructor is applying for leave');
      return;
    }
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
      await submitLeaveAction(applicantId, startDate, end, reason.trim());
      const inst = allInstructors.find((i) => i.id === applicantId);
      setSuccessMessage(
        `Holiday application for ${inst?.fullName || 'Instructor'} submitted! It's now awaiting review in the Leave Approvals queue.`
      );
      setReason('');
      setStartDate('');
      setEndDate('');
      setApplicantId(isSharedKiosk ? '' : currentUser.id);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-purple-400 flex items-center justify-center">
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

          {/* Instructor Filter Dropdown */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-purple-300 font-bold">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter View:</span>
            </div>
            <select
              value={selectedInstructorId}
              onChange={(e) => setSelectedInstructorId(e.target.value)}
              className="text-xs bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All 8 Instructors (Full Team Roster)</option>
              {allInstructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.fullName}
                </option>
              ))}
            </select>

            {selectedInstructorId !== 'ALL' ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={getGoogleCalendarSubscribeUrl(selectedInstructorId) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  title="Opens Google Calendar's 'Add by URL' subscription flow"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Subscribe to Google Calendar</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyFeedLink(selectedInstructorId)}
                  title="Copy the iCal feed link (for Apple Calendar / Outlook)"
                  className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors cursor-pointer ${
                    feedLinkCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  {feedLinkCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic px-1">
                Select an instructor to subscribe to their calendar
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
                  <h4 className="font-semibold text-sm text-white">7-Day Night Duty Roster (Overnight Stay)</h4>
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
                  className="bg-slate-800/60 border border-slate-800 rounded-xl p-2.5 text-center"
                >
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                    {new Date(shift.shiftDate).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-xs font-semibold text-indigo-400 block mt-0.5 truncate">
                    {shift.instructorName}
                  </span>
                  {shift.instructorPhone && (
                    <a
                      href={`tel:${shift.instructorPhone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white mt-1 bg-slate-900 px-2 py-0.5 rounded font-medium cursor-pointer transition-colors"
                      title={`Call ${shift.instructorName}`}
                    >
                      <Phone className="w-2.5 h-2.5" />
                      <span>Call</span>
                    </a>
                  )}
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {shift.shiftDate}
                  </span>
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
                        <span className="text-[11px] font-bold bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full">
                          {a.startTime} - {a.endTime}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-100">
                          <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>{a.instructorName}</span>
                        </div>
                        {a.instructorPhone && (
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

                      <h4 className="font-bold text-slate-200 text-sm">{a.moduleName}</h4>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-4 pt-2.5 border-t border-slate-800">
                      <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                        Batch: {a.batchName}
                      </span>
                      {a.roomLab && (
                        <span className="flex items-center space-x-1 text-slate-500 font-medium text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{a.roomLab}</span>
                        </span>
                      )}
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
              Select your name and enter your leave request. It will appear in the Leave Approvals queue for the
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
              {/* Select which instructor is applying */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Instructor Name (Cadre of 8)
                </label>
                <select
                  value={applicantId}
                  onChange={(e) => setApplicantId(e.target.value)}
                  className="w-full text-sm bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  required
                >
                  <option value="">Select your name from the 8 instructors...</option>
                  {allInstructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.fullName} (@{inst.username})
                    </option>
                  ))}
                </select>
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
