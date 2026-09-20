import React, { useState } from 'react';
import {
  User,
  ExecutiveStatusReport,
  LeaveRequest,
  DutyAssignment,
  RosterWeek,
  NightShift,
} from '@/types';
import {
  Shield,
  Calendar,
  Clock,
  Moon,
  CheckCircle2,
  AlertCircle,
  Coffee,
  BookOpen,
  MapPin,
  Check,
  X,
  Users,
  Loader2,
} from 'lucide-react';
import { reviewLeaveAction, getExecutiveReportAction } from '@/lib/actions';
import { WeeklyScheduleView } from '@/components/WeeklyScheduleView';

interface ExecutiveDashboardProps {
  currentUser: User;
  initialReport: ExecutiveStatusReport;
  pendingLeaves: LeaveRequest[];
  allInstructors: User[];
  rosterWeek?: RosterWeek;
  dutyAssignments?: DutyAssignment[];
  nightShifts?: NightShift[];
  leaveRequests?: LeaveRequest[];
  onRefresh: () => void;
  onWeekChange?: (newStartDate: string) => void;
  initialViewMode?: 'daily' | 'weekly';
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  currentUser,
  initialReport,
  pendingLeaves,
  allInstructors,
  rosterWeek,
  dutyAssignments,
  nightShifts,
  leaveRequests,
  onRefresh,
  onWeekChange,
  initialViewMode = 'daily',
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>(initialViewMode);
  const [selectedDate, setSelectedDate] = useState<string>(initialReport.date);
  const [slotFilter, setSlotFilter] = useState<string>('ALL');
  const [report, setReport] = useState<ExecutiveStatusReport>(initialReport);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Handle date or slot change
  const handleFilterChange = async (newDate: string, newSlot: string) => {
    setSelectedDate(newDate);
    setSlotFilter(newSlot);
    setLoading(true);
    try {
      const updated = await getExecutiveReportAction(newDate, newSlot);
      setReport(updated);
    } catch (err) {
      console.error('Error fetching executive report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick leave review from cockpit
  const handleQuickReview = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewingId(leaveId);
    try {
      await reviewLeaveAction(
        leaveId,
        status,
        currentUser.id,
        status === 'APPROVED' ? 'Approved via Executive Cockpit' : 'Declined via Executive Cockpit'
      );
      onRefresh();
      // Re-fetch report
      const updated = await getExecutiveReportAction(selectedDate, slotFilter);
      setReport(updated);
    } catch (err) {
      console.error('Error reviewing leave:', err);
    } finally {
      setReviewingId(null);
    }
  };

  const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Top View Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center space-x-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Today&apos;s Daily Cockpit</span>
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Entire Week Master Schedule (7-Day View)</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          {viewMode === 'daily'
            ? 'Real-Time Daily Readiness & Standby Free Pool'
            : 'Comprehensive 7-Day Academic Matrix & Cadre Workload'}
        </div>
      </div>

      {viewMode === 'weekly' && rosterWeek && dutyAssignments && nightShifts && leaveRequests ? (
        <WeeklyScheduleView
          currentUser={currentUser}
          rosterWeek={rosterWeek}
          dutyAssignments={dutyAssignments}
          nightShifts={nightShifts}
          leaveRequests={leaveRequests}
          allInstructors={allInstructors}
          onRefresh={onRefresh}
          onWeekChange={onWeekChange}
          onSelectDateForCockpit={(dateStr) => {
            handleFilterChange(dateStr, slotFilter);
            setViewMode('daily');
          }}
        />
      ) : (
        <>
          {/* Top Banner / Hero */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white border border-blue-900/50 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-sm font-medium mb-1">
              <Shield className="w-4 h-4" />
              <span>Executive Operational Cockpit • Dr. Thisara</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>Daily Instructor Deployment & Readiness</span>
              {loading && <Loader2 className="w-5 h-5 animate-spin text-blue-400 inline-block" />}
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Live situational intelligence for <span className="text-blue-300 font-semibold">{formattedDate} ({dayOfWeek})</span>. Real-time visibility into who is actively teaching, who is free on standby for ad-hoc allocations, and who is on leave.
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <Calendar className="w-4 h-4 text-blue-400 ml-2" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Viewing Date
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleFilterChange(e.target.value, slotFilter)}
                className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                handleFilterChange(today, slotFilter);
              }}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1.5 rounded-lg transition-colors ml-1"
            >
              Today
            </button>
          </div>
        </div>

        {/* Quick Slot Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium mr-2">Focus Time Block:</span>
          {[
            { id: 'ALL', label: 'Entire Day (All Slots)' },
            { id: 'Morning (09:00 - 12:00)', label: 'Morning Slot (09:00 - 12:00)' },
            { id: 'Afternoon (13:00 - 16:00)', label: 'Afternoon Slot (13:00 - 16:00)' },
            { id: 'Sunday CCS', label: 'Sunday CCS (16:30 - 17:30)' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => handleFilterChange(selectedDate, pill.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                slotFilter === pill.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Total Cadre */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase">Instructor Cadre</span>
            <Users className="w-4 h-4 text-slate-700" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{allInstructors.length}</span>
            <span className="text-xs text-slate-700">Members</span>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">Full-time operational team</p>
        </div>

        {/* Metric 2: On Duty */}
        <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase">On Duty (Teaching)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-950">{report.onDuty.length}</span>
            <span className="text-xs text-emerald-700">Assigned</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-1">Active lectures & labs</p>
        </div>

        {/* Metric 3: Free / Standby */}
        <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase">Available / Free</span>
            <Coffee className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-950">{report.freeStandby.length}</span>
            <span className="text-xs text-amber-700">Instructors</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Ready for ad-hoc / marking</p>
        </div>

        {/* Metric 4: On Leave */}
        <div className="bg-rose-50/60 rounded-xl p-4 border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase">On Leave</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-950">{report.onLeave.length}</span>
            <span className="text-xs text-rose-600">Away</span>
          </div>
          <p className="text-[11px] text-rose-600 mt-1">Approved absences</p>
        </div>
      </div>

      {/* Tonight's Night Duty Callout Banner */}
      <div className="bg-indigo-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-800 shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-800/90 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Night Shift Roster ({dayOfWeek} Night)
              </span>
              <span className="text-[10px] bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded font-semibold">
                7-Day Campus Care
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold text-white mt-1">
              {report.nightDutyInstructor ? (
                <div className="flex items-center flex-wrap gap-2">
                  <span>Designated Officer:</span>
                  <span className="text-amber-300 font-extrabold">{report.nightDutyInstructor.fullName}</span>
                  <span className="text-indigo-200 text-sm">({report.nightDutyInstructor.phone || 'No phone recorded'})</span>
                </div>
              ) : (
                <span className="text-amber-200 italic font-normal text-sm">
                  No night shift assigned for this date yet.
                </span>
              )}
            </div>
          </div>
        </div>
        {report.nightDutyInstructor?.phone && (
          <div className="flex items-center space-x-2 shrink-0">
            <a
              href={`tel:${report.nightDutyInstructor.phone.replace(/\s+/g, '')}`}
              className="flex items-center space-x-1 text-xs font-bold bg-indigo-800 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition-all border border-indigo-700"
            >
              <span>Call Officer</span>
            </a>
            <a
              href={`https://wa.me/94${report.nightDutyInstructor.phone.replace(/\D/g, '').replace(/^0/, '')}?text=Hello%20${encodeURIComponent(report.nightDutyInstructor.fullName)},%20NIBM%20School%20of%20Computing%20Night%20Duty%20Check-in.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95"
            >
              <span>WhatsApp</span>
            </a>
          </div>
        )}
      </div>

      {/* Main 3-Column Operational Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: ON DUTY */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/40 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <h3 className="font-bold text-slate-800 text-base">On Duty (Teaching)</h3>
            </div>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {report.onDuty.length} Active
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[500px]">
            {report.onDuty.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Coffee className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-sm font-medium">No teaching sessions scheduled</p>
                <p className="text-xs text-slate-400 mt-1">for this time block</p>
              </div>
            ) : (
              report.onDuty.map(({ instructor, assignment }) => (
                <div
                  key={assignment.id}
                  className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-emerald-300 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900 text-sm">{instructor.fullName}</span>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      {assignment.startTime} - {assignment.endTime}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{assignment.moduleName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 pt-1">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                        Batch: {assignment.batchName}
                      </span>
                      {assignment.roomLab && (
                        <span className="flex items-center space-x-1 text-slate-500 text-[11px]">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{assignment.roomLab}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: FREE / STANDBY (The critical requirement for Dr. Thisara!) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/40 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <h3 className="font-bold text-slate-800 text-base">Available / Free Standby</h3>
            </div>
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
              {report.freeStandby.length} Available
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[500px]">
            {report.freeStandby.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-sm font-medium">All instructors are assigned or on leave</p>
              </div>
            ) : (
              report.freeStandby.map((instructor) => (
                <div
                  key={instructor.id}
                  className="bg-amber-50/40 rounded-xl p-3.5 border border-amber-200/80 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-xs">
                      {instructor.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{instructor.fullName}</h4>
                      <p className="text-xs text-amber-800">
                        {instructor.phone || 'Available in staff room'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-1 rounded-full uppercase">
                    Ready
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-2xl text-[11px] text-slate-500 text-center">
            💡 Instructors not in class right now; available for exam invigilation, student inquiries, or emergency cover.
          </div>
        </div>

        {/* Column 3: ON LEAVE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/40 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <h3 className="font-bold text-slate-800 text-base">On Leave (Approved)</h3>
            </div>
            <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full">
              {report.onLeave.length} Away
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[500px]">
            {report.onLeave.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-sm font-medium">Full attendance!</p>
                <p className="text-xs text-slate-400 mt-1">No instructors on leave today.</p>
              </div>
            ) : (
              report.onLeave.map(({ instructor, leave }) => (
                <div
                  key={leave.id}
                  className="bg-rose-50/50 rounded-xl p-3.5 border border-rose-200"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 text-sm">{instructor.fullName}</span>
                    <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full uppercase">
                      Leave
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 italic">&ldquo;{leave.reason}&rdquo;</p>
                  <div className="text-[10px] text-slate-600 mt-2 flex items-center justify-between">
                    <span>
                      Duration: {leave.startDate} to {leave.endDate}
                    </span>
                    {leave.reviewedByName && <span>Signed by: {leave.reviewedByName}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pending Leave Requests Sign-Off Section (Dual Authority for Dr. Thisara) */}
      {pendingLeaves.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-800 text-base">
                Pending Leave Applications Awaiting Review ({pendingLeaves.length})
              </h3>
            </div>
            <span className="text-xs text-amber-800 font-medium">
              You (Dr. Thisara) or Yasith can sign off on these requests
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingLeaves.map((leave) => (
              <div
                key={leave.id}
                className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{leave.instructorName}</span>
                    <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                      {leave.startDate} {leave.startDate !== leave.endDate && `→ ${leave.endDate}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                    <strong>Reason:</strong> {leave.reason}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    disabled={reviewingId === leave.id}
                    onClick={() => handleQuickReview(leave.id, 'REJECTED')}
                    className="flex items-center space-x-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                  <button
                    disabled={reviewingId === leave.id}
                    onClick={() => handleQuickReview(leave.id, 'APPROVED')}
                    className="flex items-center space-x-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Leave</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
