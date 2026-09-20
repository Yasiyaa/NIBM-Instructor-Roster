'use client';

import React, { useState, useMemo } from 'react';
import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest } from '@/types';
import {
  Calendar,
  Clock,
  Moon,
  BookOpen,
  MapPin,
  Filter,
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Phone,
} from 'lucide-react';

interface WeeklyScheduleViewProps {
  rosterWeek: RosterWeek;
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  allInstructors: User[];
  onWeekChange?: (newStartDate: string) => void;
  onSelectDateForCockpit?: (dateStr: string) => void;
}

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  rosterWeek,
  dutyAssignments,
  nightShifts,
  leaveRequests,
  allInstructors,
  onWeekChange,
  onSelectDateForCockpit,
}) => {
  const [planningStartDate, setPlanningStartDate] = useState<string>(rosterWeek.startDate);
  const [prevRosterStartDate, setPrevRosterStartDate] = useState<string>(rosterWeek.startDate);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (rosterWeek.startDate !== prevRosterStartDate) {
    setPrevRosterStartDate(rosterWeek.startDate);
    setPlanningStartDate(rosterWeek.startDate);
  }

  const handleDateChange = (newDateStr: string) => {
    setPlanningStartDate(newDateStr);
    onWeekChange?.(newDateStr);
  };

  const handleShiftDate = (days: number) => {
    const d = new Date(planningStartDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split('T')[0];
    handleDateChange(newDateStr);
  };

  const handleJumpToSunday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (7 - day) % 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + diff);
    handleDateChange(nextSunday.toISOString().split('T')[0]);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Generate 7-day horizon
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(planningStartDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const fullDayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isSunday = d.getDay() === 0;
      const isToday = dateStr === todayStr;

      return {
        dateStr,
        dayName,
        fullDayName,
        formattedDate,
        isSunday,
        isToday,
      };
    });
  }, [planningStartDate, todayStr]);

  const weekEndDate = weekDays[6]?.dateStr || rosterWeek.endDate;

  // Filtered assignments based on instructor & search query
  const filteredAssignments = useMemo(() => {
    return dutyAssignments.filter((a) => {
      if (selectedInstructorId !== 'ALL' && a.instructorId !== selectedInstructorId) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesModule = a.moduleName?.toLowerCase().includes(query);
        const matchesBatch = a.batchName?.toLowerCase().includes(query);
        const matchesRoom = a.roomLab?.toLowerCase().includes(query);
        const matchesInstructor = a.instructorName?.toLowerCase().includes(query);
        if (!matchesModule && !matchesBatch && !matchesRoom && !matchesInstructor) {
          return false;
        }
      }
      return true;
    });
  }, [dutyAssignments, selectedInstructorId, searchQuery]);

  // Aggregate instructor weekly metrics
  const instructorStats = useMemo(() => {
    const stats: Record<
      string,
      {
        instructor: User;
        morningCount: number;
        afternoonCount: number;
        sundayCount: number;
        totalSessions: number;
        totalHours: number;
        nightShiftsCount: number;
        nightShiftDates: string[];
        onLeaveDates: string[];
      }
    > = {};

    allInstructors.forEach((inst) => {
      stats[inst.id] = {
        instructor: inst,
        morningCount: 0,
        afternoonCount: 0,
        sundayCount: 0,
        totalSessions: 0,
        totalHours: 0,
        nightShiftsCount: 0,
        nightShiftDates: [],
        onLeaveDates: [],
      };
    });

    // Count duties in this 7-day range
    dutyAssignments.forEach((a) => {
      if (a.dutyDate >= planningStartDate && a.dutyDate <= weekEndDate) {
        if (stats[a.instructorId]) {
          stats[a.instructorId].totalSessions += 1;
          if (a.startTime === '09:00') {
            stats[a.instructorId].morningCount += 1;
            stats[a.instructorId].totalHours += 3;
          } else if (a.startTime === '13:00') {
            stats[a.instructorId].afternoonCount += 1;
            stats[a.instructorId].totalHours += 3;
          } else if (a.startTime === '16:30') {
            stats[a.instructorId].sundayCount += 1;
            stats[a.instructorId].totalHours += 1;
          } else {
            stats[a.instructorId].totalHours += 3;
          }
        }
      }
    });

    // Count night shifts
    nightShifts.forEach((s) => {
      if (s.shiftDate >= planningStartDate && s.shiftDate <= weekEndDate) {
        if (stats[s.instructorId]) {
          stats[s.instructorId].nightShiftsCount += 1;
          stats[s.instructorId].nightShiftDates.push(s.shiftDate);
        }
      }
    });

    // Check leaves
    weekDays.forEach((day) => {
      leaveRequests.forEach((l) => {
        if (
          l.status === 'APPROVED' &&
          day.dateStr >= l.startDate &&
          day.dateStr <= l.endDate &&
          stats[l.instructorId]
        ) {
          if (!stats[l.instructorId].onLeaveDates.includes(day.dateStr)) {
            stats[l.instructorId].onLeaveDates.push(day.dateStr);
          }
        }
      });
    });

    return Object.values(stats);
  }, [allInstructors, dutyAssignments, nightShifts, leaveRequests, planningStartDate, weekEndDate, weekDays]);

  // Overall Week Totals
  const totalWeeklySessions = useMemo(() => {
    return dutyAssignments.filter((a) => a.dutyDate >= planningStartDate && a.dutyDate <= weekEndDate).length;
  }, [dutyAssignments, planningStartDate, weekEndDate]);

  const totalWeeklyNightShifts = useMemo(() => {
    return nightShifts.filter((s) => s.shiftDate >= planningStartDate && s.shiftDate <= weekEndDate).length;
  }, [nightShifts, planningStartDate, weekEndDate]);

  const totalWeeklyLeaves = useMemo(() => {
    const leaveSet = new Set<string>();
    leaveRequests.forEach((l) => {
      if (l.status === 'APPROVED') {
        weekDays.forEach((day) => {
          if (day.dateStr >= l.startDate && day.dateStr <= l.endDate) {
            leaveSet.add(`${l.instructorId}-${day.dateStr}`);
          }
        });
      }
    });
    return leaveSet.size;
  }, [leaveRequests, weekDays]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Week Controller */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-sm font-medium mb-1">
              <Shield className="w-4 h-4" />
              <span>Executive Weekly Overview • Dr. Thisara</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Full-Week Master Schedule</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                7-Day Matrix
              </span>
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              High-level operational view of all lectures, practical sessions, night shifts, and instructor deployments across the entire week.
            </p>
          </div>

          {/* Roster Publication Status & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 flex items-center space-x-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  rosterWeek.status === 'PUBLISHED' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 animate-pulse'
                }`}
              ></span>
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Roster State
                </div>
                <div className="text-xs font-black text-white">
                  {rosterWeek.status === 'PUBLISHED' ? (
                    <span className="text-emerald-400">PUBLISHED</span>
                  ) : (
                    <span className="text-amber-400">DRAFT (IN PROGRESS)</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Print Weekly Timetable"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Print Timetable</span>
            </button>
          </div>
        </div>

        {/* Dynamic Week Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleShiftDate(-7)}
              className="flex items-center space-x-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev 7 Days</span>
            </button>
            <button
              onClick={() => handleDateChange(todayStr)}
              className="text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              Current Week
            </button>
            <button
              onClick={handleJumpToSunday}
              className="text-xs bg-indigo-600/60 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg border border-indigo-500/50 transition-colors cursor-pointer"
            >
              Start on Sunday
            </button>
            <button
              onClick={() => handleShiftDate(7)}
              className="flex items-center space-x-1 text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <span>Next 7 Days</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400 font-medium">Week Starting:</span>
            <input
              type="date"
              value={planningStartDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-normal">
              → {weekEndDate}
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 pt-4 border-t border-slate-800/60">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-slate-400 font-medium">Filter Cadre:</span>
            <select
              value={selectedInstructorId}
              onChange={(e) => setSelectedInstructorId(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All 8 Instructors (Full Cadre)</option>
              {allInstructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search module, batch (e.g. DSE 24.1), or lab..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {(selectedInstructorId !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedInstructorId('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block mb-4 p-4 border-b border-slate-700">
        <h1 className="text-xl font-black text-slate-100">National Institute of Business Management (NIBM)</h1>
        <h2 className="text-base font-bold text-slate-300">School of Computing — Instructor Duty Roster</h2>
        <p className="text-xs text-slate-400">
          Week: {planningStartDate} to {weekEndDate} | Status: {rosterWeek.status} | Generated for Dr. Thisara
        </p>
      </div>

      {/* High-Level Weekly KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase">Weekly Lectures</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-100">{totalWeeklySessions}</span>
            <span className="text-xs text-slate-400">Sessions</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across morning, afternoon & CCS</p>
        </div>

        <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400 uppercase">Night Coverage</span>
            <Moon className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-300">{totalWeeklyNightShifts}/7</span>
            <span className="text-xs text-indigo-400">Nights</span>
          </div>
          <p className="text-[11px] text-indigo-400 mt-1">Designated overnight officers</p>
        </div>

        <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase">Cadre Absences</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-300">{totalWeeklyLeaves}</span>
            <span className="text-xs text-rose-600">Person-Days</span>
          </div>
          <p className="text-[11px] text-rose-600 mt-1">Approved holidays this week</p>
        </div>

        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase">Active Cadre</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-300">{allInstructors.length}</span>
            <span className="text-xs text-emerald-400">Instructors</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-1">Full team monitored</p>
        </div>
      </div>

      {/* 7-Day Master Roster Matrix */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-800/60">
          <div>
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>7-Day Departmental Timetable Grid</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Click &quot;Drilldown ↗&quot; on any date to inspect immediate standby free pools and live room assignments in the Daily Cockpit.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-500"></span> Morning (09-12)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Afternoon (13-16)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-purple-500"></span> Sunday CCS
            </span>
          </div>
        </div>

        {/* 7-Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 bg-slate-800">
          {weekDays.map((day) => {
            // Find morning assignments for this day
            const morningDuties = filteredAssignments.filter(
              (a) => a.dutyDate === day.dateStr && (a.startTime === '09:00' || a.slotLabel.includes('Morning'))
            );

            // Find afternoon assignments for this day
            const afternoonDuties = filteredAssignments.filter(
              (a) => a.dutyDate === day.dateStr && (a.startTime === '13:00' || a.slotLabel.includes('Afternoon'))
            );

            // Find Sunday CCS assignment
            const sundayDuties = filteredAssignments.filter(
              (a) => a.dutyDate === day.dateStr && (a.startTime === '16:30' || a.slotLabel.includes('CCS'))
            );

            // Night Shift
            const nightShift = nightShifts.find((s) => s.shiftDate === day.dateStr);
            const nightInstructor = nightShift ? allInstructors.find((i) => i.id === nightShift.instructorId) : null;

            // Leaves on this date
            const dayLeaves = leaveRequests.filter(
              (l) => l.status === 'APPROVED' && day.dateStr >= l.startDate && day.dateStr <= l.endDate
            );

            return (
              <div
                key={day.dateStr}
                className={`bg-slate-900 flex flex-col min-h-[520px] ${
                  day.isToday ? 'ring-2 ring-blue-500 z-10' : ''
                }`}
              >
                {/* Column Header */}
                <div
                  className={`p-3 border-b border-slate-800 text-center ${
                    day.isToday
                      ? 'bg-blue-600 text-white'
                      : day.isSunday
                      ? 'bg-purple-500/10 text-purple-300'
                      : 'bg-slate-800/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">{day.dayName}</span>
                    {day.isToday && (
                      <span className="text-[9px] bg-slate-900 text-blue-400 font-bold px-1.5 py-0.2 rounded-full uppercase">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-black mt-0.5">{day.formattedDate}</div>

                  {/* Drilldown button to Daily Cockpit */}
                  {onSelectDateForCockpit && (
                    <button
                      onClick={() => onSelectDateForCockpit(day.dateStr)}
                      className={`text-[10px] mt-1.5 font-semibold flex items-center justify-center space-x-1 w-full py-0.5 rounded transition-colors cursor-pointer print:hidden ${
                        day.isToday
                          ? 'bg-blue-700 hover:bg-blue-800 text-white'
                          : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-800'
                      }`}
                      title={`Open Dr. Thisara's Cockpit for ${day.dayName} ${day.formattedDate}`}
                    >
                      <span>Drilldown</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Day Slots Container */}
                <div className="p-2 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* 1. MORNING SLOT (09:00 - 12:00) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>09:00 - 12:00</span>
                        </span>
                        {morningDuties.length > 0 && (
                          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1 rounded">
                            {morningDuties.length}
                          </span>
                        )}
                      </div>

                      {morningDuties.length === 0 ? (
                        <div className="bg-slate-800/60 rounded-lg p-2 border border-dashed border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 italic">No lectures</span>
                        </div>
                      ) : (
                        morningDuties.map((duty) => (
                          <div
                            key={duty.id}
                            className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 shadow-2xs hover:shadow-xs transition-shadow"
                          >
                            <div className="text-xs font-bold text-blue-300 line-clamp-2 leading-snug">
                              {duty.moduleName}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span className="bg-blue-500/25 text-blue-400 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                {duty.batchName}
                              </span>
                              {duty.roomLab && (
                                <span className="text-slate-400 font-medium text-[10px] flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                  {duty.roomLab}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-blue-100 flex items-center space-x-1 text-[11px] font-semibold text-slate-200">
                              <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[9px]">
                                {duty.instructorName ? duty.instructorName.substring(0, 1) : 'I'}
                              </div>
                              <span className="truncate">{duty.instructorName}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 2. AFTERNOON SLOT (13:00 - 16:00) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>13:00 - 16:00</span>
                        </span>
                        {afternoonDuties.length > 0 && (
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1 rounded">
                            {afternoonDuties.length}
                          </span>
                        )}
                      </div>

                      {afternoonDuties.length === 0 ? (
                        <div className="bg-slate-800/60 rounded-lg p-2 border border-dashed border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 italic">No lectures</span>
                        </div>
                      ) : (
                        afternoonDuties.map((duty) => (
                          <div
                            key={duty.id}
                            className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 shadow-2xs hover:shadow-xs transition-shadow"
                          >
                            <div className="text-xs font-bold text-amber-300 line-clamp-2 leading-snug">
                              {duty.moduleName}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span className="bg-amber-500/25 text-amber-400 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                {duty.batchName}
                              </span>
                              {duty.roomLab && (
                                <span className="text-slate-400 font-medium text-[10px] flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                  {duty.roomLab}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-amber-100 flex items-center space-x-1 text-[11px] font-semibold text-slate-200">
                              <div className="w-4 h-4 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[9px]">
                                {duty.instructorName ? duty.instructorName.substring(0, 1) : 'I'}
                              </div>
                              <span className="truncate">{duty.instructorName}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 3. SUNDAY CCS SPECIAL SLOT (16:30 - 17:30) */}
                    {day.isSunday && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-purple-400 uppercase tracking-wider px-1">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>Sunday CCS (16:30 - 17:30)</span>
                          </span>
                        </div>

                        {sundayDuties.length === 0 ? (
                          <div className="bg-purple-500/10 rounded-lg p-2 border border-dashed border-purple-500/20 text-center">
                            <span className="text-[10px] text-purple-400 italic">No CCS session</span>
                          </div>
                        ) : (
                          sundayDuties.map((duty) => (
                            <div
                              key={duty.id}
                              className="bg-purple-500/15 border border-purple-500/20 rounded-lg p-2 shadow-2xs"
                            >
                              <div className="text-xs font-bold text-purple-300 leading-snug">
                                {duty.moduleName}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[11px]">
                                <span className="bg-purple-500/25 text-purple-400 font-black px-1.5 py-0.2 rounded text-[10px]">
                                  {duty.batchName}
                                </span>
                                {duty.roomLab && (
                                  <span className="text-slate-400 font-medium text-[10px]">
                                    {duty.roomLab}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 pt-1 border-t border-purple-500/20 flex items-center space-x-1 text-[11px] font-semibold text-purple-300">
                                <div className="w-4 h-4 rounded-full bg-purple-700 text-white font-bold flex items-center justify-center text-[9px]">
                                  {duty.instructorName ? duty.instructorName.substring(0, 1) : 'I'}
                                </div>
                                <span className="truncate">{duty.instructorName}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* BOTTOM SECTION: NIGHT SHIFT & LEAVES */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    {/* Night Shift Officer */}
                    <div className="bg-indigo-950 text-white rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Moon className="w-3 h-3 text-amber-300" />
                          <span>Night Shift</span>
                        </span>
                      </div>
                      <div className="mt-1 font-bold text-white text-[11px] truncate">
                        {nightInstructor ? (
                          <span className="text-amber-300">{nightInstructor.fullName}</span>
                        ) : (
                          <span className="text-slate-400 italic font-normal text-[10px]">Not Assigned</span>
                        )}
                      </div>
                      {nightInstructor?.phone && (
                        <a
                          href={`tel:${nightInstructor.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-white mt-1 bg-indigo-900/80 hover:bg-indigo-800 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                          title={`Call ${nightInstructor.fullName}`}
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>Call: {nightInstructor.phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Approved Leaves On This Date */}
                    {dayLeaves.length > 0 && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-1.5">
                        <div className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                          <span>On Leave ({dayLeaves.length})</span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {dayLeaves.map((l) => (
                            <div
                              key={l.id}
                              className="text-[10px] font-medium text-rose-400 bg-rose-500/15 px-1 py-0.5 rounded truncate"
                              title={`${l.instructorName}: ${l.reason}`}
                            >
                              {l.instructorName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cadre Deployment & Workload Summary Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/60">
          <div>
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Instructor Cadre Weekly Workload & Deployment Table</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Comprehensive distribution of teaching hours and night shifts for all 8 team members across this 7-day period.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2.5 py-1 rounded-full">
            {allInstructors.length} Instructors Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-3 py-3 text-center">Morning (09-12)</th>
                <th className="px-3 py-3 text-center">Afternoon (13-16)</th>
                <th className="px-3 py-3 text-center">Sunday CCS</th>
                <th className="px-3 py-3 text-center">Total Sessions</th>
                <th className="px-3 py-3 text-center">Est. Teaching Hrs</th>
                <th className="px-4 py-3 text-center">Night Shifts</th>
                <th className="px-4 py-3 text-center">Leave Status</th>
                <th className="px-4 py-3 text-center">Workload Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {instructorStats.map((item) => {
                const isSelected = selectedInstructorId === item.instructor.id;
                const totalHours = item.totalHours;

                let balanceBadge = (
                  <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Balanced
                  </span>
                );
                if (item.onLeaveDates.length >= 3) {
                  balanceBadge = (
                    <span className="bg-rose-500/15 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      On Leave
                    </span>
                  );
                } else if (item.totalSessions >= 5) {
                  balanceBadge = (
                    <span className="bg-purple-500/15 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Heavy Load
                    </span>
                  );
                } else if (item.totalSessions === 0 && item.onLeaveDates.length === 0) {
                  balanceBadge = (
                    <span className="bg-amber-500/15 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Standby / Free
                    </span>
                  );
                }

                return (
                  <tr
                    key={item.instructor.id}
                    className={`hover:bg-slate-800/80 transition-colors ${
                      isSelected ? 'bg-blue-500/10 font-semibold' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 font-black flex items-center justify-center text-[10px]">
                          {item.instructor.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-100">{item.instructor.fullName}</div>
                          {item.instructor.phone ? (
                            <a
                              href={`tel:${item.instructor.phone.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-400 font-semibold hover:underline"
                              title={`Call ${item.instructor.fullName}`}
                            >
                              <Phone className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{item.instructor.phone}</span>
                            </a>
                          ) : (
                            <div className="text-[10px] text-slate-400">{item.instructor.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-medium">{item.morningCount}</td>
                    <td className="px-3 py-3 text-center font-medium">{item.afternoonCount}</td>
                    <td className="px-3 py-3 text-center font-medium">
                      {item.sundayCount > 0 ? (
                        <span className="text-purple-400 font-bold">{item.sundayCount}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-black text-slate-100 text-sm">{item.totalSessions}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-200">
                      {totalHours} hrs
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.nightShiftsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-400 font-bold px-2 py-0.5 rounded text-[11px]">
                          <Moon className="w-3 h-3 text-amber-500" />
                          <span>{item.nightShiftsCount} Night{item.nightShiftsCount > 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.onLeaveDates.length > 0 ? (
                        <span className="bg-rose-500/15 text-rose-400 font-semibold px-2 py-0.5 rounded text-[10px]">
                          {item.onLeaveDates.length} day{item.onLeaveDates.length > 1 ? 's' : ''} away
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[11px] flex items-center justify-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{balanceBadge}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
