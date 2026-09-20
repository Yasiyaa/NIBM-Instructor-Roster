'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ExecutiveStatusReport, User } from '@/types';
import {
  Calendar,
  Clock,
  Moon,
  Coffee,
  BookOpen,
  MapPin,
  AlertCircle,
  LogIn,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { getExecutiveReportAction } from '@/lib/actions';

interface PublicStatusBoardProps {
  initialReport: ExecutiveStatusReport;
  allInstructors: User[];
  onOpenLogin: () => void;
}

export const PublicStatusBoard: React.FC<PublicStatusBoardProps> = ({
  initialReport,
  allInstructors,
  onOpenLogin,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialReport.date);
  const [slotFilter, setSlotFilter] = useState<string>('ALL');
  const [report, setReport] = useState<ExecutiveStatusReport>(initialReport);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Real-time ticking second hand
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const todayStr = currentTime.toISOString().split('T')[0];
  const isSelectedDateToday = selectedDate === todayStr;

  // Detect current active lecture slot based on system clock
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const timeFloat = currentHour + currentMinutes / 60;
  const isSunday = currentTime.getDay() === 0;

  const currentSlotDetected = useMemo(() => {
    if (timeFloat >= 9 && timeFloat < 12) return 'Morning (09:00 - 12:00)';
    if (timeFloat >= 13 && timeFloat < 16) return 'Afternoon (13:00 - 16:00)';
    if (isSunday && timeFloat >= 16.5 && timeFloat < 17.5) return 'Sunday CCS';
    return null;
  }, [timeFloat, isSunday]);

  const handleFilterChange = async (newDate: string, newSlot: string) => {
    setSelectedDate(newDate);
    setSlotFilter(newSlot);
    setLoading(true);
    try {
      const updated = await getExecutiveReportAction(newDate, newSlot);
      setReport(updated);
    } catch (err) {
      console.error('Error fetching status report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const updated = await getExecutiveReportAction(selectedDate, slotFilter);
      setReport(updated);
    } catch (err) {
      console.error('Error refreshing status report:', err);
    } finally {
      setLoading(false);
    }
  };

  const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-950/80 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center font-black text-white shadow-inner">
              NIBM
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Instructor Daily Status Board
                </h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Live View
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Public Monitor • All {allInstructors.length} Cadre Members Monitored • Live Deployment & Free Pool
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Live Ticking Clock */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs shadow-inner">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-emerald-400 tracking-wider">{formattedTime}</span>
              <span className="text-slate-600 text-[10px]">SLST</span>
            </div>

            {/* Quick Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Refresh Roster Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {/* Staff Sign In */}
            <button
              onClick={onOpenLogin}
              className="flex items-center space-x-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Staff Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        {/* Date & Slot Filter Bar */}
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Selected Date
              </span>
              <div className="text-sm font-bold text-white flex items-center space-x-2">
                <span>
                  {dayOfWeek}, {formattedDate}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleFilterChange(e.target.value, slotFilter)}
                  className="bg-slate-900 text-xs text-slate-300 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                />
                {isSelectedDateToday && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-bold uppercase">
                    Today
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Slot Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Day' },
              { id: 'Morning (09:00 - 12:00)', label: 'Morning (9-12)' },
              { id: 'Afternoon (13:00 - 16:00)', label: 'Afternoon (1-4)' },
              { id: 'Sunday CCS', label: 'Sunday CCS (4:30-5:30)' },
            ].map((p) => {
              const isCurrentActive = isSelectedDateToday && currentSlotDetected === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleFilterChange(selectedDate, p.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    slotFilter === p.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  <span>{p.label}</span>
                  {isCurrentActive && (
                    <span className="bg-emerald-400 text-slate-950 font-black text-[9px] px-1 py-0.2 rounded uppercase">
                      Now
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tonight's Night Duty Banner */}
        <div className="bg-indigo-950/90 border border-indigo-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-800 flex items-center justify-center text-amber-300">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                Tonight&apos;s Night Shift Caretaker
              </span>
              <div className="text-base font-bold text-white">
                {report.nightDutyInstructor ? (
                  <span>
                    Officer on Duty:{' '}
                    <span className="text-amber-300">{report.nightDutyInstructor.fullName}</span>{' '}
                    ({report.nightDutyInstructor.phone || 'NIBM Staff'})
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal italic">
                    No night duty assigned for this date.
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="text-xs text-indigo-300 bg-indigo-900/80 px-3 py-1.5 rounded-xl border border-indigo-700/60 self-start sm:self-center">
            Overnight Lab & Facility Stay
          </span>
        </div>

        {/* Three High-Contrast Status Buckets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. ON DUTY (TEACHING) */}
          <div className="bg-slate-800/90 rounded-2xl border border-emerald-900/60 shadow-lg flex flex-col">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-emerald-950/40 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                <h2 className="font-bold text-white text-base">Working Now (On Duty)</h2>
              </div>
              <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {report.onDuty.length} Active
              </span>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[520px]">
              {report.onDuty.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Coffee className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-medium text-slate-400">No classes in session</p>
                  <p className="text-xs text-slate-500">for this time period</p>
                </div>
              ) : (
                report.onDuty.map(({ instructor, assignment }) => (
                  <div
                    key={assignment.id}
                    className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-700 hover:border-emerald-500/60 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-sm">{instructor.fullName}</span>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                        {assignment.startTime} - {assignment.endTime}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-medium flex items-center space-x-1.5 mt-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{assignment.moduleName}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5 pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                        Batch: {assignment.batchName}
                      </span>
                      {assignment.roomLab && (
                        <span className="flex items-center space-x-1 text-slate-400 text-[11px]">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{assignment.roomLab}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. FREE / STANDBY (The essential query for finding who is free!) */}
          <div className="bg-slate-800/90 rounded-2xl border border-amber-900/60 shadow-lg flex flex-col">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-amber-950/40 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <h2 className="font-bold text-white text-base">Available / Free Standby</h2>
              </div>
              <span className="text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                {report.freeStandby.length} Free
              </span>
            </div>

            <div className="p-4 space-y-2.5 flex-1 overflow-y-auto max-h-[520px]">
              {report.freeStandby.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-medium text-slate-400">No free instructors</p>
                  <p className="text-xs text-slate-500">All members are teaching or on leave</p>
                </div>
              ) : (
                report.freeStandby.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/80 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold text-xs flex items-center justify-center">
                        {instructor.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{instructor.fullName}</h3>
                        <p className="text-[11px] text-amber-300/90">
                          {instructor.phone || 'Available in staff room'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                      Free
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-slate-900/60 border-t border-slate-800 text-[11px] text-slate-400 text-center rounded-b-2xl">
              Available for student queries, lab assistance, or marking.
            </div>
          </div>

          {/* 3. ON LEAVE (APPROVED) */}
          <div className="bg-slate-800/90 rounded-2xl border border-rose-900/60 shadow-lg flex flex-col">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-rose-950/40 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                <h2 className="font-bold text-white text-base">On Leave (Away)</h2>
              </div>
              <span className="text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                {report.onLeave.length} Away
              </span>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[520px]">
              {report.onLeave.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-400" />
                  <p className="text-sm font-medium text-slate-300">Full Attendance</p>
                  <p className="text-xs text-slate-500">No instructors on leave today.</p>
                </div>
              ) : (
                report.onLeave.map(({ instructor, leave }) => (
                  <div
                    key={leave.id}
                    className="bg-slate-900/80 rounded-xl p-3.5 border border-rose-900/60"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-sm">{instructor.fullName}</span>
                      <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded uppercase">
                        Leave
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 italic">&ldquo;{leave.reason}&rdquo;</p>
                    <div className="text-[10px] text-slate-400 mt-2">
                      Duration: {leave.startDate} {leave.startDate !== leave.endDate && `to ${leave.endDate}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        National Institute of Business Management • School of Computing • Public Operations Monitor
      </footer>
    </div>
  );
};
