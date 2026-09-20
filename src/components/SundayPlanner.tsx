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
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Moon,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Copy,
  Send,
  Loader2,
  UserCheck,
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

const COMMON_BATCHES = [
  'DSE 24.1F',
  'DCSD 24.1P',
  'HDCN 23.2',
  'CCS Batch',
  'MIS 24.1',
  'CSNE 23.1',
];

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

const COMMON_ROOMS = [
  'Lab 01',
  'Lab 02',
  'Lab 03',
  'Lab 04',
  'CISCO Lab',
  'Main Auditorium Hall',
];

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
  const [repeatForOtherSlot, setRepeatForOtherSlot] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  // Dynamic Week Starting Date State (Can anchor planning to ANY date)
  const [userSelectedStartDate, setUserSelectedStartDate] = useState<string | null>(null);
  const planningStartDate = userSelectedStartDate ?? rosterWeek.startDate;

  const handleDateChange = (newDateStr: string) => {
    setUserSelectedStartDate(newDateStr);
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

  // Generate the 7 days of the horizon
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
      isSunday: d.getDay() === 0,
      isToday: dateStr === new Date().toISOString().split('T')[0],
    };
  });

  // Calculate workload per instructor
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

  const handleOpenAddModal = (
    dateStr: string,
    slotLabel: string,
    startTime: string,
    endTime: string
  ) => {
    setModalData({ date: dateStr, slotLabel, startTime, endTime });
    setInstructorId('');
    setBatchName('');
    setModuleName('');
    setRepeatForOtherSlot(false);
    setFormError(null);
    setModalOpen(true);
  };

  // 1-Click duplicate session to opposite slot
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

    // If "Full Day session" is checked
    if (repeatForOtherSlot) {
      const isMorning = modalData.startTime === '09:00';
      const otherStartTime = isMorning ? '13:00' : '09:00';
      const otherEndTime = isMorning ? '16:00' : '12:00';
      const otherSlotLabel = isMorning
        ? 'Afternoon (13:00 - 16:00)'
        : 'Morning (09:00 - 12:00)';

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

  const handleDeleteDuty = async (id: string) => {
    if (confirm('Remove this duty allocation?')) {
      await deleteDutyAction(id);
      onRefresh();
    }
  };

  const handleSetNightShift = async (shiftDate: string, newInstructorId: string) => {
    if (!newInstructorId) return;
    const res = await setNightShiftAction(rosterWeek.id, shiftDate, newInstructorId);
    if (!res.success) {
      alert(res.error);
    } else {
      onRefresh();
    }
  };

  const handlePublish = async () => {
    if (
      confirm(
        'Publish this weekly roster? All instructors and Dr. Thisara will immediately see the finalized schedule.'
      )
    ) {
      const res = await publishRosterAction(rosterWeek.id, currentUser.id);
      if (res.success) {
        setPublishMessage('Roster published successfully to all portals!');
        setTimeout(() => setPublishMessage(null), 4000);
        onRefresh();
      } else {
        alert(res.error || 'Failed to publish roster');
      }
    }
  };

  const isInstructorOnLeave = (instId: string, dateStr: string) => {
    return leaveRequests.some(
      (l) =>
        l.instructorId === instId &&
        l.status === 'APPROVED' &&
        dateStr >= l.startDate &&
        dateStr <= l.endDate
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Planner Studio Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 text-white border border-emerald-900/50 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Sunday Planning Studio • Demonstrator Console</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Weekly Task & Duty Allocator
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Equitably distribute morning, afternoon, and night shift duties across the cadre.
              Collision prevention engine blocks double-bookings in real-time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Publish Status Badge */}
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  rosterWeek.status === 'PUBLISHED'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {rosterWeek.status === 'PUBLISHED' ? 'Published' : 'Draft Mode'}
              </span>
            </div>

            {/* Publish Action Button */}
            <button
              onClick={handlePublish}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish Week</span>
            </button>
          </div>
        </div>

        {publishMessage && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{publishMessage}</span>
          </div>
        )}

        {/* Dynamic Date Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs text-slate-400 font-semibold mr-1">Planning Anchor:</span>
            <button
              onClick={() => handleShiftDate(-7)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition-colors"
              title="Previous 7 Days"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={planningStartDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            />
            <button
              onClick={() => handleShiftDate(7)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition-colors"
              title="Next 7 Days"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleJumpToSunday}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-semibold transition-all"
            >
              Jump to Sunday
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Range: <span className="text-white font-bold">{weekDays[0].formattedDate}</span> to{' '}
            <span className="text-white font-bold">{weekDays[6].formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Cadre Workload Distribution Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Teaching & Night Duty Cadre Workload Meter
            </h4>
          </div>
          <span className="text-[11px] text-slate-600">
            Guarantees equitable allocation across cadre
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {allInstructors.map((inst) => {
            const stats = workloadMap[inst.id] || { sessions: 0, nightShifts: 0 };
            return (
              <div
                key={inst.id}
                className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center hover:border-slate-300 transition-all"
              >
                <div className="text-xs font-bold text-slate-800 truncate" title={inst.fullName}>
                  {inst.fullName.split(' ')[0]}
                </div>
                <div className="flex items-center justify-center space-x-2 mt-1.5 text-[11px]">
                  <span
                    className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                    title="Teaching Sessions"
                  >
                    {stats.sessions}d
                  </span>
                  <span
                    className="font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded"
                    title="Night Duties"
                  >
                    {stats.nightShifts}n
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-Day Planning Studio Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map(({ dateStr, dayName, formattedDate, isSunday, isToday }) => {
          const morningDuties = dutyAssignments.filter(
            (a) => a.dutyDate === dateStr && a.startTime === '09:00'
          );
          const afternoonDuties = dutyAssignments.filter(
            (a) => a.dutyDate === dateStr && a.startTime === '13:00'
          );
          const sundayDuties = dutyAssignments.filter(
            (a) => a.dutyDate === dateStr && a.startTime === '16:30'
          );
          const nightShift = nightShifts.find((s) => s.shiftDate === dateStr);

          return (
            <div
              key={dateStr}
              className={`bg-white rounded-2xl border flex flex-col transition-all shadow-xs ${
                isToday
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3 border-b rounded-t-2xl flex items-center justify-between ${
                  isToday
                    ? 'bg-emerald-500 text-white'
                    : isSunday
                    ? 'bg-amber-500/10 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-100 text-slate-800'
                }`}
              >
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">{dayName}</div>
                  <div
                    className={`text-[11px] ${
                      isToday ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    {formattedDate}
                  </div>
                </div>
                {isToday && (
                  <span className="text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase">
                    Today
                  </span>
                )}
              </div>

              {/* Duty Slots Container */}
              <div className="p-2 space-y-2.5 flex-1 flex flex-col justify-between">
                {/* SLOT 1: MORNING (09:00 - 12:00) */}
                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-200/70">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      09:00 - 12:00
                    </span>
                    <button
                      onClick={() =>
                        handleOpenAddModal(
                          dateStr,
                          'Morning (09:00 - 12:00)',
                          '09:00',
                          '12:00'
                        )
                      }
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Add Morning Session"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {morningDuties.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1 text-center">
                        No session
                      </div>
                    ) : (
                      morningDuties.map((duty) => (
                        <div
                          key={duty.id}
                          className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs group relative"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {duty.instructorName}
                            </span>
                            <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() =>
                                  handleCopyDutyToSlot(
                                    duty,
                                    '13:00',
                                    '16:00',
                                    'Afternoon (13:00 - 16:00)'
                                  )
                                }
                                title="Duplicate to Afternoon"
                                className="p-0.5 text-slate-400 hover:text-blue-600 rounded"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteDuty(duty.id)}
                                title="Remove Assignment"
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                            {duty.batchName}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate mt-0.5">
                            {duty.moduleName}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SLOT 2: AFTERNOON (13:00 - 16:00) */}
                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-200/70">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      13:00 - 16:00
                    </span>
                    <button
                      onClick={() =>
                        handleOpenAddModal(
                          dateStr,
                          'Afternoon (13:00 - 16:00)',
                          '13:00',
                          '16:00'
                        )
                      }
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Add Afternoon Session"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {afternoonDuties.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1 text-center">
                        No session
                      </div>
                    ) : (
                      afternoonDuties.map((duty) => (
                        <div
                          key={duty.id}
                          className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs group relative"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {duty.instructorName}
                            </span>
                            <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() =>
                                  handleCopyDutyToSlot(
                                    duty,
                                    '09:00',
                                    '12:00',
                                    'Morning (09:00 - 12:00)'
                                  )
                                }
                                title="Duplicate to Morning"
                                className="p-0.5 text-slate-400 hover:text-blue-600 rounded"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteDuty(duty.id)}
                                title="Remove Assignment"
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                            {duty.batchName}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate mt-0.5">
                            {duty.moduleName}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SLOT 3: SUNDAY EVENING SPECIAL CCS (16:30 - 17:30) */}
                {isSunday && (
                  <div className="bg-amber-50/70 rounded-xl p-2 border border-amber-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        CCS (16:30 - 17:30)
                      </span>
                      <button
                        onClick={() =>
                          handleOpenAddModal(
                            dateStr,
                            'Sunday CCS (16:30 - 17:30)',
                            '16:30',
                            '17:30'
                          )
                        }
                        className="p-1 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                        title="Add Sunday CCS Session"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {sundayDuties.length === 0 ? (
                        <div className="text-[11px] text-amber-600/70 italic py-1 text-center">
                          Not allocated
                        </div>
                      ) : (
                        sundayDuties.map((duty) => (
                          <div
                            key={duty.id}
                            className="bg-white p-2 rounded-lg border border-amber-200 shadow-2xs group relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {duty.instructorName}
                              </span>
                              <button
                                onClick={() => handleDeleteDuty(duty.id)}
                                title="Remove Assignment"
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                              CCS Batch
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* NIGHT SHIFT CARETAKER SELECTOR */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5 text-indigo-700 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <Moon className="w-3 h-3" />
                    <span>Night Officer</span>
                  </div>
                  <select
                    value={nightShift?.instructorId || ''}
                    onChange={(e) => handleSetNightShift(dateStr, e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {allInstructors.map((inst) => {
                      const onLeave = isInstructorOnLeave(inst.id, dateStr);
                      return (
                        <option
                          key={inst.id}
                          value={inst.id}
                          disabled={onLeave}
                        >
                          {inst.fullName} {onLeave ? '(On Leave)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD DUTY MODAL */}
      {modalOpen && modalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Allocate Teaching Session</h3>
                <p className="text-xs text-slate-500">
                  {modalData.date} • {modalData.slotLabel}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDuty} className="space-y-4">
              {/* Instructor Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Instructor
                </label>
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="w-full text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">Choose an instructor...</option>
                  {allInstructors.map((inst) => {
                    const onLeave = isInstructorOnLeave(inst.id, modalData.date);
                    return (
                      <option
                        key={inst.id}
                        value={inst.id}
                        disabled={onLeave}
                      >
                        {inst.fullName} {onLeave ? '(On Approved Leave)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Batch Selector & Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batch Code
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. DSE 24.1F"
                  className="w-full text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_BATCHES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBatchName(b)}
                      className="text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 px-2 py-0.5 rounded font-semibold transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Selector & Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Module Name
                </label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. Database Management Systems"
                  className="w-full text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_MODULES.slice(0, 4).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModuleName(m)}
                      className="text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 px-2 py-0.5 rounded font-semibold transition-colors truncate max-w-[200px]"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room / Lab */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Venue / Lab Location
                </label>
                <select
                  value={roomLab}
                  onChange={(e) => setRoomLab(e.target.value)}
                  className="w-full text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {COMMON_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Full Day Checkbox */}
              {modalData.startTime !== '16:30' && (
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    id="repeatForOtherSlot"
                    checked={repeatForOtherSlot}
                    onChange={(e) => setRepeatForOtherSlot(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label
                    htmlFor="repeatForOtherSlot"
                    className="text-xs text-slate-700 font-semibold cursor-pointer"
                  >
                    Full-Day Booking (automatically book the other daytime slot too)
                  </label>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Assign Duty</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
