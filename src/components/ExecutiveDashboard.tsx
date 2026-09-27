import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  ExecutiveStatusReport,
  LeaveRequest,
  DutyAssignment,
  RosterWeek,
  NightShift,
  AuditLog,
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
  Phone,
  ScrollText,
  Filter,
} from 'lucide-react';
import { reviewLeaveAction, getExecutiveReportAction, getAuditLogsAction } from '@/lib/actions';
import { WeeklyScheduleView } from '@/components/WeeklyScheduleView';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  DUTY_ASSIGNED: 'Duty Assigned',
  DUTY_REMOVED: 'Duty Removed',
  NIGHT_DUTY_SET: 'Night Duty Set',
  LEAVE_REQUESTED: 'Leave Requested',
  LEAVE_APPROVED: 'Leave Approved',
  LEAVE_REJECTED: 'Leave Rejected',
  ROSTER_PUBLISHED: 'Roster Published',
  WEEK_CLONED: 'Week Cloned',
  CATALOG_UPDATED: 'Catalog Updated',
};

const AUDIT_ACTION_STYLES: Record<string, string> = {
  DUTY_ASSIGNED: 'bg-indigo-500/15 text-indigo-400',
  DUTY_REMOVED: 'bg-rose-500/15 text-rose-400',
  NIGHT_DUTY_SET: 'bg-amber-500/15 text-amber-400',
  LEAVE_REQUESTED: 'bg-slate-700 text-slate-300',
  LEAVE_APPROVED: 'bg-emerald-500/15 text-emerald-400',
  LEAVE_REJECTED: 'bg-rose-500/15 text-rose-400',
  ROSTER_PUBLISHED: 'bg-blue-500/15 text-blue-400',
  WEEK_CLONED: 'bg-purple-500/15 text-purple-400',
  CATALOG_UPDATED: 'bg-teal-500/15 text-teal-400',
};

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
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // ---- Governance / Audit Trail Drawer ----
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditActorFilter, setAuditActorFilter] = useState<string>('ALL');
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const logs = await getAuditLogsAction({
        action: auditActionFilter,
        userId: auditActorFilter,
        startDate: auditStartDate || undefined,
        endDate: auditEndDate || undefined,
      });
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditActionFilter, auditActorFilter, auditStartDate, auditEndDate]);

  // Refetches from the server action whenever the drawer opens or a filter
  // changes -- the standard "fetch data on dependency change" effect.
  useEffect(() => {
    if (auditDrawerOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAuditLogs();
    }
  }, [auditDrawerOpen, fetchAuditLogs]);

  useEffect(() => {
    if (!auditDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAuditDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [auditDrawerOpen]);

  // Handle date or slot change
  const handleFilterChange = async (newDate: string, newSlot: string) => {
    setSelectedDate(newDate);
    setSlotFilter(newSlot);
    try {
      const updated = await getExecutiveReportAction(newDate, newSlot);
      setReport(updated);
    } catch (err) {
      console.error('Error fetching executive report:', err);
    }
  };

  // Quick leave review from cockpit
  const handleQuickReview = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewingId(leaveId);
    try {
      await reviewLeaveAction(
        leaveId,
        status,
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

  return (
    <div className="space-y-6">
      {/* Top View Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-sm print:hidden">
        <div className="flex items-center space-x-2">
          <div className="flex items-center p-1 bg-slate-800 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-100'
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
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Entire Week Schedule</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(currentUser.role === 'EXECUTIVE' || currentUser.role === 'ADMIN') && (
            <button
              onClick={() => setAuditDrawerOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition-colors cursor-pointer print:hidden"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Governance Log</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'weekly' && rosterWeek && dutyAssignments && nightShifts && leaveRequests ? (
        <WeeklyScheduleView
          rosterWeek={rosterWeek}
          dutyAssignments={dutyAssignments}
          nightShifts={nightShifts}
          leaveRequests={leaveRequests}
          allInstructors={allInstructors}
          onWeekChange={onWeekChange}
          onSelectDateForCockpit={(dateStr) => {
            handleFilterChange(dateStr, slotFilter);
            setViewMode('daily');
          }}
        />
      ) : (
        <>
          {/* Top Banner / Hero */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-sm font-medium mb-1">
              <Shield className="w-4 h-4" />
              <span>Executive Cockpit</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Daily Readiness
            </h2>
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
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase">Instructor Cadre</span>
            <Users className="w-4 h-4 text-slate-300" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-100">{allInstructors.length}</span>
            <span className="text-xs text-slate-300">Members</span>
          </div>
        </div>

        {/* Metric 2: On Duty */}
        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase">On Duty (Teaching)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-300">{report.onDuty.length}</span>
            <span className="text-xs text-emerald-400">Assigned</span>
          </div>
        </div>

        {/* Metric 3: Free / Standby */}
        <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase">Available / Free</span>
            <Coffee className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-300">{report.freeStandby.length}</span>
            <span className="text-xs text-amber-400">Instructors</span>
          </div>
        </div>

        {/* Metric 4: On Leave */}
        <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase">On Leave</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-300">{report.onLeave.length}</span>
            <span className="text-xs text-rose-600">Away</span>
          </div>
        </div>
      </div>

      {/* Tonight's Night Duty Callout Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Night Shift Roster ({dayOfWeek} Night)
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                7-Day Rotation
              </span>
            </div>
            <div className="text-base font-semibold text-white mt-0.5 flex flex-wrap items-center gap-2">
              {report.nightDutyInstructor ? (
                <>
                  <span>
                    Designated Officer: <span className="text-indigo-400">{report.nightDutyInstructor.fullName}</span>
                  </span>
                  {report.nightDutyInstructor.phone && (
                    <a
                      href={`tel:${report.nightDutyInstructor.phone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ml-1"
                      title={`Call ${report.nightDutyInstructor.fullName}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call: {report.nightDutyInstructor.phone}</span>
                    </a>
                  )}
                </>
              ) : (
                <span className="text-slate-500 italic font-normal">
                  No night shift assigned for this date yet.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Operational Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: ON DUTY */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-emerald-500/10 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <h3 className="font-bold text-slate-200 text-base">On Duty (Teaching)</h3>
            </div>
            <span className="text-xs font-bold bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full">
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
                  className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800 hover:border-emerald-500/20 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{instructor.fullName}</span>
                      {instructor.phone && (
                        <a
                          href={`tel:${instructor.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-0.5 rounded transition-colors cursor-pointer"
                          title={`Call ${instructor.fullName} (${instructor.phone})`}
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
                      {assignment.startTime === '09:00' && assignment.endTime === '16:00'
                        ? '09:00 - 16:00 (Full Day)'
                        : `${assignment.startTime} - ${assignment.endTime}`}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex items-center space-x-1.5 font-medium text-slate-200">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{assignment.moduleName ?? assignment.dutyType}</span>
                    </div>
                    {assignment.notes && <p className="italic">{assignment.notes}</p>}
                    <div className="flex items-center justify-between text-slate-500 pt-1">
                      {assignment.batchName && (
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-semibold text-[11px]">
                          Batch: {assignment.batchName}
                        </span>
                      )}
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
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-amber-500/10 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <h3 className="font-bold text-slate-200 text-base">Available / Free Standby</h3>
            </div>
            <span className="text-xs font-bold bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full">
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
                  className="bg-amber-500/10 rounded-xl p-3.5 border border-amber-500/20 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/25 text-amber-400 font-bold flex items-center justify-center text-xs">
                      {instructor.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-200 text-sm">{instructor.fullName}</h4>
                      <p className="text-xs text-amber-400">
                        {instructor.phone || 'Available in staff room'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {instructor.phone && (
                      <a
                        href={`tel:${instructor.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-white bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                        title={`Call ${instructor.fullName} directly`}
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    )}
                    <span className="text-[10px] font-bold bg-amber-500/25 text-amber-400 px-2 py-1 rounded-full uppercase">
                      Ready
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 bg-slate-800/60 border-t border-slate-800 rounded-b-2xl text-[11px] text-slate-500 text-center">
            💡 Instructors not in class right now; available for exam invigilation, student inquiries, or emergency cover.
          </div>
        </div>

        {/* Column 3: ON LEAVE */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-rose-500/10 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <h3 className="font-bold text-slate-200 text-base">On Leave (Approved)</h3>
            </div>
            <span className="text-xs font-bold bg-rose-500/15 text-rose-400 px-2.5 py-0.5 rounded-full">
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
                  className="bg-rose-500/10 rounded-xl p-3.5 border border-rose-500/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 text-sm">{instructor.fullName}</span>
                      {instructor.phone && (
                        <a
                          href={`tel:${instructor.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-800 transition-colors"
                          title={`Call ${instructor.fullName}`}
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] font-bold bg-rose-500/25 text-rose-400 px-2 py-0.5 rounded-full uppercase">
                      Leave
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 italic">&quot;{leave.reason}&quot;</p>
                  <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-between">
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
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-200 text-base">
                Pending Leave Applications Awaiting Review ({pendingLeaves.length})
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-medium">
              You can review and sign off on these requests
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingLeaves.map((leave) => (
              <div
                key={leave.id}
                className="bg-slate-900 rounded-xl p-4 border border-amber-500/20 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-sm">{leave.instructorName}</span>
                    <span className="text-xs bg-amber-500/15 text-amber-400 font-semibold px-2 py-0.5 rounded">
                      {leave.startDate} {leave.startDate !== leave.endDate && `→ ${leave.endDate}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 bg-slate-800/60 p-2 rounded border border-slate-800">
                    <strong>Reason:</strong> {leave.reason}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                  <button
                    disabled={reviewingId === leave.id}
                    onClick={() => handleQuickReview(leave.id, 'REJECTED')}
                    className="flex items-center space-x-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors"
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

      {/* Governance / Audit Trail Drawer */}
      {auditDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs print:hidden">
          <button
            aria-label="Close governance log drawer"
            onClick={() => setAuditDrawerOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative bg-slate-900 w-full max-w-lg h-full shadow-2xl border-l border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900 text-white">
              <div>
                <div className="flex items-center space-x-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>Compliance Console</span>
                </div>
                <h3 className="text-lg font-bold">Governance Log</h3>
              </div>
              <button
                onClick={() => setAuditDrawerOpen(false)}
                className="text-slate-300 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-800/60 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-bold">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Logs</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-300 font-semibold rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">All Action Types</option>
                  {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={auditActorFilter}
                  onChange={(e) => setAuditActorFilter(e.target.value)}
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-300 font-semibold rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">All Team Members</option>
                  {[...allInstructors, currentUser].map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-300 font-semibold rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="From date"
                />
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-300 font-semibold rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="To date"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
              {auditLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs">Loading logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No governance events match the current filters.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          AUDIT_ACTION_STYLES[log.action] || 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {new Date(log.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{log.metadata}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      by <span className="font-semibold text-slate-500">{log.userName || 'System'}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
