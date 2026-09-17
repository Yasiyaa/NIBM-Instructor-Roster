'use client';

import React, { useState } from 'react';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
} from '@/types';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Moon,
  Send,
  Layers,
  Sparkles,
  BookOpen,
  MapPin,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Copy,
} from 'lucide-react';
import {
  addDutyAction,
  deleteDutyAction,
  setNightShiftAction,
  publishRosterAction,
} from '@/lib/actions';

interface SundayPlannerProps {
  currentUser: User;
  rosterWeek: RosterWeek;
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  allInstructors: User[];
  onRefresh: () => void;
  onWeekChange?: (newStartDate: string) => void;
}

const COMMON_BATCHES = ['DSE 24.1F', 'DCSD 24.1P', 'HDCN 23.2', 'CCS Batch', 'MIS 24.1', 'CSNE 23.1'];
const COMMON_MODULES = [
  'Database Management Systems',
  'Object-Oriented Programming (Java)',
  'Data Structures & Algorithms',
  'Computer Networks & Routing',
  'Cyber Security Operations',
  'Web Application Development',
  'Cloud Computing Essentials',
  'Python for Data Science',
];
const COMMON_ROOMS = ['Lab 01', 'Lab 02', 'Lab 03', 'Lab 04', 'CISCO Lab', 'Main Auditorium Hall'];

export const SundayPlanner: React.FC<SundayPlannerProps> = ({
  currentUser,
  rosterWeek,
  dutyAssignments,
  nightShifts,
  leaveRequests,
  allInstructors,
  onRefresh,
  onWeekChange,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    date: string;
    slotLabel: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Form state
  const [instructorId, setInstructorId] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');
  const [moduleName, setModuleName] = useState<string>('');
  const [roomLab, setRoomLab] = useState<string>('Lab 01');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  // Dynamic Week Starting Date State (User can plan starting from ANY date!)
  const [planningStartDate, setPlanningStartDate] = useState<string>(rosterWeek.startDate);

  React.useEffect(() => {
    setPlanningStartDate(rosterWeek.startDate);
  }, [rosterWeek.startDate]);

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

  // Generate the 7 days of the week starting from ANY chosen start date
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(planningStartDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      dateStr,
      dayName,
      formattedDate,
      isSunday: d.getDay() === 0, // dynamically detect Sunday for CCS evening slot
    };
  });

  // Calculate workload per instructor this week
  const workloadMap: Record<string, { sessions: number; nightShifts: number }> = {};
  allInstructors.forEach((inst) => {
    workloadMap[inst.id] = { sessions: 0, nightShifts: 0 };
  });

  dutyAssignments.forEach((a) => {
    if (workloadMap[a.instructorId]) {
      workloadMap[a.instructorId].sessions += 1;
    }
  });

  nightShifts.forEach((s) => {
    if (workloadMap[s.instructorId]) {
      workloadMap[s.instructorId].nightShifts += 1;
    }
  });

  const [repeatForOtherSlot, setRepeatForOtherSlot] = useState(false);

  // Open modal for a specific day and slot
  const handleOpenAddModal = (dateStr: string, slotLabel: string, startTime: string, endTime: string) => {
    setModalData({ date: dateStr, slotLabel, startTime, endTime });
    setInstructorId('');
    setBatchName('');
    setModuleName('');
    setRepeatForOtherSlot(false);
    setFormError(null);
    setModalOpen(true);
  };

  // 1-Click Copy a session to the opposite slot (e.g. Morning -> Afternoon)
  const handleCopyDutyToSlot = async (
    assignment: DutyAssignment,
    targetStartTime: string,
    targetEndTime: string,
    targetSlotLabel: string
  ) => {
    setIsSubmitting(true);
    const res = await addDutyAction({
      rosterWeekId: rosterWeek.id,
      instructorId: assignment.instructorId,
      dutyDate: assignment.dutyDate,
      slotLabel: targetSlotLabel,
      startTime: targetStartTime,
      endTime: targetEndTime,
      batchName: assignment.batchName,
      moduleName: assignment.moduleName,
      roomLab: assignment.roomLab,
    });
    setIsSubmitting(false);

    if (!res.success) {
      alert(res.error || 'Failed to copy session');
    } else {
      onRefresh();
    }
  };

  // Submit slot assignment
  const handleSaveDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData) return;
    if (!instructorId) {
      setFormError('Please select an instructor');
      return;
    }
    if (!batchName.trim()) {
      setFormError('Please enter a batch name');
      return;
    }
    if (!moduleName.trim()) {
      setFormError('Please enter a module name');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const res = await addDutyAction({
      rosterWeekId: rosterWeek.id,
      instructorId,
      dutyDate: modalData.date,
      slotLabel: modalData.slotLabel,
      startTime: modalData.startTime,
      endTime: modalData.endTime,
      batchName: batchName.trim(),
      moduleName: moduleName.trim(),
      roomLab: roomLab.trim(),
    });

    if (!res.success) {
      setIsSubmitting(false);
      setFormError(res.error || 'Failed to assign duty');
      return;
    }

    // If "Also assign to other slot" is checked (Full Day session)
    if (repeatForOtherSlot) {
      const isMorning = modalData.startTime === '09:00';
      const otherStartTime = isMorning ? '13:00' : '09:00';
      const otherEndTime = isMorning ? '16:00' : '12:00';
      const otherSlotLabel = isMorning ? 'Afternoon (13:00 - 16:00)' : 'Morning (09:00 - 12:00)';

      await addDutyAction({
        rosterWeekId: rosterWeek.id,
        instructorId,
        dutyDate: modalData.date,
        slotLabel: otherSlotLabel,
        startTime: otherStartTime,
        endTime: otherEndTime,
        batchName: batchName.trim(),
        moduleName: moduleName.trim(),
        roomLab: roomLab.trim(),
      });
    }

    setIsSubmitting(false);
    setModalOpen(false);
    onRefresh();
  };

  // Remove duty slot
  const handleDeleteDuty = async (id: string) => {
    if (confirm('Remove this duty allocation?')) {
      await deleteDutyAction(id);
      onRefresh();
    }
  };

  // Set night shift instructor
  const handleSetNightShift = async (shiftDate: string, newInstructorId: string) => {
    if (!newInstructorId) return;
    const res = await setNightShiftAction(rosterWeek.id, shiftDate, newInstructorId);
    if (!res.success) {
      alert(res.error);
    } else {
      onRefresh();
    }
  };

  // Publish roster
  const handlePublish = async () => {
    if (confirm('Publish this weekly roster? All instructors and Dr. Thisara will see the finalized schedule.')) {
      await publishRosterAction(rosterWeek.id, currentUser.id);
      setPublishMessage('Roster published successfully!');
      setTimeout(() => setPublishMessage(null), 4000);
      onRefresh();
    }
  };

  // Helper to check if instructor is on approved leave on given date
  const isInstructorOnLeave = (instId: string, dateStr: string) => {
    return leaveRequests.some(
      (l) => l.instructorId === instId && l.status === 'APPROVED' && dateStr >= l.startDate && dateStr <= l.endDate
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Planner Studio Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 text-white border border-emerald-900/50 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Sunday Planning Studio • Demonstrator Console</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Weekly Task & Duty Allocator
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Plan the week ahead for all 8 team members. Assign batches, modules, labs, and the 7-day night duties. Real-time conflict engine prevents double-booking and blocks allocations on approved leave dates.
            </p>
          </div>

          {/* Roster Status & Action */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <div className="text-right mr-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Roster State
              </div>
              <div className="flex items-center space-x-1.5 justify-end">
                <span
                  className={`w-2 h-2 rounded-full ${
                    rosterWeek.status === 'PUBLISHED' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                ></span>
                <span
                  className={`text-xs font-black uppercase ${
                    rosterWeek.status === 'PUBLISHED' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {rosterWeek.status}
                </span>
              </div>
            </div>

            <button
              onClick={handlePublish}
              disabled={rosterWeek.status === 'PUBLISHED'}
              className={`flex items-center space-x-1.5 text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition-all ${
                rosterWeek.status === 'PUBLISHED'
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{rosterWeek.status === 'PUBLISHED' ? 'Published' : 'Publish Roster'}</span>
            </button>
          </div>
        </div>

        {publishMessage && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{publishMessage}</span>
          </div>
        )}
      </div>

      {/* Interactive Planning Horizon & Week Start Selector */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">
                Planning Horizon (Start from any date)
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded border border-slate-700">
                7 Days Window
              </span>
            </div>
            <div className="text-sm font-black text-white flex items-center space-x-2 mt-0.5">
              <span>Week Starting:</span>
              <input
                type="date"
                value={planningStartDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-slate-800 text-white text-xs font-bold border border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                → {weekDays[6]?.formattedDate} ({weekDays[6]?.dateStr})
              </span>
            </div>
          </div>
        </div>

        {/* Quick Horizon Jump Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleShiftDate(-7)}
            className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Shift backward by 7 days"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev 7 Days</span>
          </button>

          <button
            type="button"
            onClick={handleJumpToSunday}
            className="text-xs bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer"
            title="Jump to this Sunday"
          >
            Start on Sunday
          </button>

          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              handleDateChange(today);
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-bold transition-colors cursor-pointer"
            title="Start from Today"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => handleShiftDate(7)}
            className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Shift forward by 7 days"
          >
            <span>Next 7 Days</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Workload Balancer Widget */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Workload Balancer (Cadre Allocation Meter)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Keep distribution balanced across all 8 instructors
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {allInstructors.map((inst) => {
            const data = workloadMap[inst.id] || { sessions: 0, nightShifts: 0 };
            return (
              <div
                key={inst.id}
                className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-center flex flex-col justify-between"
              >
                <div className="text-xs font-bold text-slate-800 truncate" title={inst.fullName}>
                  {inst.fullName.split(' ')[0]}
                </div>
                <div className="my-1.5 flex items-center justify-center space-x-2 text-xs">
                  <span className="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded text-[11px]" title="Teaching Slots">
                    {data.sessions} sess
                  </span>
                  <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[11px]" title="Night Duty">
                    {data.nightShifts} 🌙
                  </span>
                </div>
                <div className="text-[10px] text-slate-700">
                  Total: {data.sessions + data.nightShifts} duties
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The 7-Day Planning Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-base">Weekly Schedule Matrix</h3>
            <span className="text-xs text-slate-500 font-medium">
              ({planningStartDate} to {weekDays[6]?.dateStr})
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Morning (9-12)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              <span>Afternoon (1-4)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
              <span>Sunday CCS (4:30-5:30)</span>
            </span>
          </div>
        </div>

        {/* Matrix Grid Columns */}
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {weekDays.map((day) => {
            const dayAssignments = dutyAssignments.filter((a) => a.dutyDate === day.dateStr);
            const nightShift = nightShifts.find((s) => s.shiftDate === day.dateStr);

            return (
              <div
                key={day.dateStr}
                className={`flex flex-col min-h-[560px] ${
                  day.isSunday ? 'bg-purple-50/25' : 'bg-white'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 text-center border-b ${
                    day.isSunday
                      ? 'bg-purple-100/60 border-purple-200 text-purple-950 font-bold'
                      : 'bg-slate-100/60 border-slate-200 text-slate-800 font-bold'
                  }`}
                >
                  <div className="text-sm">{day.dayName}</div>
                  <div className="text-xs text-slate-500 font-normal">{day.formattedDate}</div>
                </div>

                {/* Slot 1: Morning (09:00 - 12:00) */}
                <div className="p-2 border-b border-slate-100 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                    <span className="text-emerald-700">09:00 - 12:00</span>
                    <button
                      onClick={() =>
                        handleOpenAddModal(
                          day.dateStr,
                          'Morning (09:00 - 12:00)',
                          '09:00',
                          '12:00'
                        )
                      }
                      className="p-1 hover:bg-emerald-100 text-emerald-700 rounded transition-colors"
                      title="Assign morning slot"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Assignments in Morning */}
                  <div className="space-y-1.5">
                    {dayAssignments
                      .filter((a) => a.startTime === '09:00')
                      .map((assignment) => {
                        const hasAfternoon = dayAssignments.some(
                          (other) => other.instructorId === assignment.instructorId && other.startTime === '13:00'
                        );

                        return (
                          <div
                            key={assignment.id}
                            className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs relative group shadow-2xs flex flex-col justify-between"
                          >
                            <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!hasAfternoon && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyDutyToSlot(
                                      assignment,
                                      '13:00',
                                      '16:00',
                                      'Afternoon (13:00 - 16:00)'
                                    )
                                  }
                                  className="p-1 text-emerald-700 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors"
                                  title="Copy session to Afternoon (13:00 - 16:00)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteDuty(assignment.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 bg-white/80 hover:bg-rose-50 rounded transition-colors"
                                title="Remove assignment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            <div>
                              <div className="font-bold text-emerald-950 truncate pr-12">
                                {assignment.instructorName}
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-800 truncate">
                                {assignment.batchName}
                              </div>
                              <div className="text-[10px] text-slate-600 truncate">
                                {assignment.moduleName}
                              </div>
                              {assignment.roomLab && (
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  📍 {assignment.roomLab}
                                </div>
                              )}
                            </div>

                            {/* 1-Click Copy to Afternoon Action Button */}
                            {!hasAfternoon ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyDutyToSlot(
                                    assignment,
                                    '13:00',
                                    '16:00',
                                    'Afternoon (13:00 - 16:00)'
                                  )
                                }
                                className="mt-2 w-full flex items-center justify-center space-x-1 text-[10px] font-bold text-emerald-900 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300/80 py-1 px-1.5 rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Copy this session to Afternoon (13:00 - 16:00)"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy to Afternoon (1-4)</span>
                              </button>
                            ) : (
                              <div className="mt-1.5 text-[9px] font-semibold text-emerald-700/80 flex items-center space-x-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Also in Afternoon</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Slot 2: Afternoon (13:00 - 16:00) */}
                <div className="p-2 border-b border-slate-100 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                    <span className="text-blue-700">13:00 - 16:00</span>
                    <button
                      onClick={() =>
                        handleOpenAddModal(
                          day.dateStr,
                          'Afternoon (13:00 - 16:00)',
                          '13:00',
                          '16:00'
                        )
                      }
                      className="p-1 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                      title="Assign afternoon slot"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Assignments in Afternoon */}
                  <div className="space-y-1.5">
                    {dayAssignments
                      .filter((a) => a.startTime === '13:00')
                      .map((assignment) => {
                        const hasMorning = dayAssignments.some(
                          (other) => other.instructorId === assignment.instructorId && other.startTime === '09:00'
                        );

                        return (
                          <div
                            key={assignment.id}
                            className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs relative group shadow-2xs flex flex-col justify-between"
                          >
                            <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!hasMorning && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyDutyToSlot(
                                      assignment,
                                      '09:00',
                                      '12:00',
                                      'Morning (09:00 - 12:00)'
                                    )
                                  }
                                  className="p-1 text-blue-700 hover:text-blue-950 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                                  title="Copy session to Morning (09:00 - 12:00)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteDuty(assignment.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 bg-white/80 hover:bg-rose-50 rounded transition-colors"
                                title="Remove assignment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            <div>
                              <div className="font-bold text-blue-950 truncate pr-12">
                                {assignment.instructorName}
                              </div>
                              <div className="text-[11px] font-semibold text-blue-800 truncate">
                                {assignment.batchName}
                              </div>
                              <div className="text-[10px] text-slate-600 truncate">
                                {assignment.moduleName}
                              </div>
                              {assignment.roomLab && (
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  📍 {assignment.roomLab}
                                </div>
                              )}
                            </div>

                            {/* 1-Click Copy to Morning Action Button */}
                            {!hasMorning ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyDutyToSlot(
                                    assignment,
                                    '09:00',
                                    '12:00',
                                    'Morning (09:00 - 12:00)'
                                  )
                                }
                                className="mt-2 w-full flex items-center justify-center space-x-1 text-[10px] font-bold text-blue-900 bg-blue-100/90 hover:bg-blue-200 border border-blue-300/80 py-1 px-1.5 rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Copy this session to Morning (09:00 - 12:00)"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy to Morning (9-12)</span>
                              </button>
                            ) : (
                              <div className="mt-1.5 text-[9px] font-semibold text-blue-700/80 flex items-center space-x-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Also in Morning</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Special Sunday Evening Slot (16:30 - 17:30 CCS Batch) */}
                {day.isSunday && (
                  <div className="p-2 border-b border-purple-200 bg-purple-50/50">
                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-800 mb-1">
                      <span>CCS (16:30 - 17:30)</span>
                      <button
                        onClick={() =>
                          handleOpenAddModal(
                            day.dateStr,
                            'Sunday CCS (16:30 - 17:30)',
                            '16:30',
                            '17:30'
                          )
                        }
                        className="p-1 hover:bg-purple-200 text-purple-800 rounded transition-colors"
                        title="Assign Sunday CCS slot"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {dayAssignments
                        .filter((a) => a.startTime === '16:30')
                        .map((assignment) => (
                          <div
                            key={assignment.id}
                            className="bg-purple-100/70 border border-purple-300 rounded-lg p-2 text-xs relative group shadow-2xs"
                          >
                            <button
                              onClick={() => handleDeleteDuty(assignment.id)}
                              className="absolute top-1 right-1 p-1 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove assignment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="font-bold text-purple-950 truncate pr-3">
                              {assignment.instructorName}
                            </div>
                            <div className="text-[11px] font-semibold text-purple-800 truncate">
                              {assignment.batchName}
                            </div>
                            <div className="text-[10px] text-slate-700 truncate">
                              {assignment.moduleName}
                            </div>
                            {assignment.roomLab && (
                              <div className="text-[9px] text-slate-500 mt-0.5">
                                📍 {assignment.roomLab}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 7-Day Night Duty Row */}
                <div className="p-2 bg-slate-900 text-white rounded-b-md mt-auto">
                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 mb-1 uppercase tracking-wider">
                    <span className="flex items-center space-x-1">
                      <Moon className="w-3 h-3" />
                      <span>Night Duty</span>
                    </span>
                  </div>

                  <select
                    value={nightShift?.instructorId || ''}
                    onChange={(e) => handleSetNightShift(day.dateStr, e.target.value)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Instructor...</option>
                    {allInstructors.map((inst) => {
                      const onLeave = isInstructorOnLeave(inst.id, day.dateStr);
                      return (
                        <option
                          key={inst.id}
                          value={inst.id}
                          disabled={onLeave}
                          className="bg-slate-800 text-white"
                        >
                          {inst.fullName} {onLeave ? '(On Leave)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Add Duty Assignment */}
      {modalOpen && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Teaching Duty</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalData.date} • {modalData.slotLabel}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDuty} className="mt-4 space-y-4">
              {/* Select Instructor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Instructor (Cadre of 8)
                </label>
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select Instructor...</option>
                  {allInstructors.map((inst) => {
                    const onLeave = isInstructorOnLeave(inst.id, modalData.date);
                    return (
                      <option key={inst.id} value={inst.id} disabled={onLeave}>
                        {inst.fullName} {onLeave ? '⛔ (On Approved Leave)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Free-form Batch Name + Quick Suggestion Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Batch Code / Group
                </label>
                <input
                  type="text"
                  placeholder="e.g. DSE 24.1F or CCS Batch"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMON_BATCHES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBatchName(b)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Free-form Module Name + Quick Suggestion Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Module / Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Database Management Systems"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMON_MODULES.slice(0, 4).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModuleName(m)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors truncate max-w-[200px]"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room / Lab */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Room / Lab Venue
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab 01"
                  value={roomLab}
                  onChange={(e) => setRoomLab(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMON_ROOMS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoomLab(r)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Day / Duplicate Session Checkbox */}
              {modalData.startTime === '09:00' && (
                <label className="flex items-start space-x-2.5 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatForOtherSlot}
                    onChange={(e) => setRepeatForOtherSlot(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-950 block">
                      Also duplicate this session to Afternoon (13:00 - 16:00)
                    </span>
                    <span className="text-emerald-700 text-[11px] block mt-0.5">
                      Automatically books a full-day workshop/lab session with the same instructor, batch, module, and lab.
                    </span>
                  </div>
                </label>
              )}

              {modalData.startTime === '13:00' && (
                <label className="flex items-start space-x-2.5 p-3 bg-blue-50/80 border border-blue-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatForOtherSlot}
                    onChange={(e) => setRepeatForOtherSlot(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-blue-950 block">
                      Also duplicate this session to Morning (09:00 - 12:00)
                    </span>
                    <span className="text-blue-700 text-[11px] block mt-0.5">
                      Automatically books a full-day workshop/lab session with the same instructor, batch, module, and lab.
                    </span>
                  </div>
                </label>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Validating...' : 'Assign Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
