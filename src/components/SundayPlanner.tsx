'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
  AcademicCatalog,
} from '@/types';
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Moon,
  Send,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Copy,
  Phone,
  MessageCircle,
  ClipboardCopy,
  X,
  CopyPlus,
  LibraryBig,
  Pencil,
  Check,
} from 'lucide-react';
import {
  addDutyAction,
  deleteDutyAction,
  setNightShiftAction,
  publishRosterAction,
  cloneWeekAction,
  addBatchAction,
  removeBatchAction,
  updateBatchAction,
  addRoomAction,
  removeRoomAction,
  updateRoomAction,
  addModuleAction,
  removeModuleAction,
  updateModuleAction,
} from '@/lib/actions';
import { useDialog } from './DialogProvider';

interface SundayPlannerProps {
  rosterWeek: RosterWeek;
  dutyAssignments: DutyAssignment[];
  nightShifts: NightShift[];
  leaveRequests: LeaveRequest[];
  allInstructors: User[];
  catalog: AcademicCatalog;
  onRefresh: () => void;
  onWeekChange?: (newStartDate: string) => void;
}

export const SundayPlanner: React.FC<SundayPlannerProps> = ({
  rosterWeek,
  dutyAssignments,
  nightShifts,
  leaveRequests,
  allInstructors,
  catalog,
  onRefresh,
  onWeekChange,
}) => {
  const { confirm, notify } = useDialog();
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
  const [isCloning, setIsCloning] = useState(false);
  const [cloneMessage, setCloneMessage] = useState<string | null>(null);

  // Dynamic Week Starting Date State (User can plan starting from ANY date!)
  const [planningStartDate, setPlanningStartDate] = useState<string>(rosterWeek.startDate);
  const [prevRosterStartDate, setPrevRosterStartDate] = useState<string>(rosterWeek.startDate);

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
      await notify(res.error || 'Failed to copy session');
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
    if (await confirm({ message: 'Remove this duty allocation?', confirmLabel: 'Remove', danger: true })) {
      await deleteDutyAction(id);
      onRefresh();
    }
  };

  // Set night shift instructor
  const handleSetNightShift = async (shiftDate: string, newInstructorId: string) => {
    if (!newInstructorId) return;
    const res = await setNightShiftAction(rosterWeek.id, shiftDate, newInstructorId);
    if (!res.success) {
      await notify(res.error || 'Failed to set night duty.');
    } else {
      onRefresh();
    }
  };

  // Publish roster
  const handlePublish = async () => {
    const proceed = await confirm({
      title: 'Publish roster',
      message: 'Publish this weekly roster? All instructors and Dr. Thisara will see the finalized schedule.',
      confirmLabel: 'Publish',
    });
    if (proceed) {
      await publishRosterAction(rosterWeek.id);
      setPublishMessage('Roster published successfully!');
      setTimeout(() => setPublishMessage(null), 4000);
      onRefresh();
    }
  };

  // Clone the preceding 7 days' assignments and night shifts into this week's draft
  const handleCloneWeek = async () => {
    const proceed = await confirm({
      title: 'Clone previous week',
      message: `Clone last week's duties and night shifts into the week starting ${planningStartDate}? Collisions and approved-leave conflicts will be skipped automatically.`,
      confirmLabel: 'Clone',
    });
    if (!proceed) {
      return;
    }
    setIsCloning(true);
    setCloneMessage(null);
    try {
      const result = await cloneWeekAction(planningStartDate);
      const skippedCount = result.skippedDuties.length + result.skippedNightShifts.length;
      setCloneMessage(
        `Cloned ${result.clonedDuties} duty session${result.clonedDuties === 1 ? '' : 's'} and ${result.clonedNightShifts} night shift${
          result.clonedNightShifts === 1 ? '' : 's'
        } from the previous week.${skippedCount > 0 ? ` ${skippedCount} skipped due to conflicts.` : ''}`
      );
      setTimeout(() => setCloneMessage(null), 8000);
      onRefresh();
    } finally {
      setIsCloning(false);
    }
  };

  // Helper to check if instructor is on approved leave on given date
  const isInstructorOnLeave = (instId: string, dateStr: string) => {
    return leaveRequests.some(
      (l) => l.instructorId === instId && l.status === 'APPROVED' && dateStr >= l.startDate && dateStr <= l.endDate
    );
  };

  // ---- Academic Catalog Manager (dynamic batches & rooms/labs) ----
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);

  useEffect(() => {
    if (!catalogModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [catalogModalOpen]);

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogBusy(true);
    setCatalogError(null);
    const res = await addBatchAction(newBatchName);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to add batch');
      return;
    }
    setNewBatchName('');
    onRefresh();
  };

  const handleRemoveBatch = async (name: string) => {
    setCatalogBusy(true);
    setCatalogError(null);
    const res = await removeBatchAction(name);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to remove batch');
      return;
    }
    onRefresh();
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogBusy(true);
    setCatalogError(null);
    const res = await addRoomAction(newRoomName);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to add room/lab');
      return;
    }
    setNewRoomName('');
    onRefresh();
  };

  const handleRemoveRoom = async (name: string) => {
    setCatalogBusy(true);
    setCatalogError(null);
    const res = await removeRoomAction(name);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to remove room/lab');
      return;
    }
    onRefresh();
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogBusy(true);
    setCatalogError(null);
    const res = await addModuleAction(newModuleName);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to add module');
      return;
    }
    setNewModuleName('');
    onRefresh();
  };

  const handleRemoveModule = async (name: string) => {
    setCatalogBusy(true);
    setCatalogError(null);
    const res = await removeModuleAction(name);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to remove module');
      return;
    }
    onRefresh();
  };

  // Inline "save to list" from the Assign Teaching Duty form itself -- lets
  // a demonstrator type a one-off module/room and permanently add it to the
  // catalog without leaving the form to open the separate manager.
  const handleSaveModuleInline = async () => {
    setCatalogBusy(true);
    const res = await addModuleAction(moduleName);
    setCatalogBusy(false);
    if (res.success) onRefresh();
    else await notify(res.error || 'Failed to save module to the catalog.');
  };

  const handleSaveRoomInline = async () => {
    setCatalogBusy(true);
    const res = await addRoomAction(roomLab);
    setCatalogBusy(false);
    if (res.success) onRefresh();
    else await notify(res.error || 'Failed to save room/lab to the catalog.');
  };

  // Inline rename for an existing catalog entry (batch/room/module) --
  // one shared bit of state since it's the same edit-in-place flow for all
  // three lists, just dispatched to a different action per kind.
  const [editingCatalogItem, setEditingCatalogItem] = useState<{
    kind: 'batch' | 'room' | 'module';
    original: string;
  } | null>(null);
  const [editCatalogValue, setEditCatalogValue] = useState('');

  const handleStartEditCatalogItem = (kind: 'batch' | 'room' | 'module', name: string) => {
    setEditingCatalogItem({ kind, original: name });
    setEditCatalogValue(name);
    setCatalogError(null);
  };

  const handleCancelEditCatalogItem = () => {
    setEditingCatalogItem(null);
    setEditCatalogValue('');
  };

  const handleSaveEditCatalogItem = async () => {
    if (!editingCatalogItem) return;
    const { kind, original } = editingCatalogItem;
    setCatalogBusy(true);
    setCatalogError(null);
    const res =
      kind === 'batch'
        ? await updateBatchAction(original, editCatalogValue)
        : kind === 'room'
          ? await updateRoomAction(original, editCatalogValue)
          : await updateModuleAction(original, editCatalogValue);
    setCatalogBusy(false);
    if (!res.success) {
      setCatalogError(res.error || 'Failed to update entry.');
      return;
    }
    setEditingCatalogItem(null);
    setEditCatalogValue('');
    onRefresh();
  };

  // ---- WhatsApp Cadre Dispatcher ----
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [groupCopied, setGroupCopied] = useState(false);

  useEffect(() => {
    if (!dispatchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDispatchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatchOpen]);

  // Converts a local Sri Lankan number ("071 257 0137") into WhatsApp's
  // country-code-prefixed digit format ("94712570137").
  const normalizePhoneForWhatsApp = (phone: string): string | null => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('94')) return digits;
    if (digits.startsWith('0')) return `94${digits.slice(1)}`;
    return digits;
  };

  // Collects one instructor's duties/night-shifts for the visible week, grouped by day.
  const getInstructorWeekEntries = (instId: string) => {
    return weekDays
      .map((day) => {
        const items: string[] = dutyAssignments
          .filter((a) => a.instructorId === instId && a.dutyDate === day.dateStr)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((a) => `${a.startTime}-${a.endTime} ${a.batchName} — ${a.moduleName}${a.roomLab ? ` (${a.roomLab})` : ''}`);

        if (nightShifts.some((s) => s.instructorId === instId && s.shiftDate === day.dateStr)) {
          items.push('🌙 Night Duty');
        }
        return { ...day, items };
      })
      .filter((d) => d.items.length > 0);
  };

  const buildIndividualMessage = (inst: User): string => {
    const entries = getInstructorWeekEntries(inst.id);
    const bodyLines =
      entries.length === 0
        ? ['No teaching duties or night shifts assigned this week.']
        : entries.flatMap((d) => [`*${d.dayName}, ${d.formattedDate}*`, ...d.items.map((i) => `  • ${i}`)]);

    return [
      '📋 *NIBM Weekly Duty Roster*',
      `Week: ${planningStartDate} → ${weekDays[6]?.dateStr}`,
      '',
      `Hi ${inst.fullName.split(' ')[0]}, here's your schedule for this week:`,
      '',
      ...bodyLines,
      '',
      '— NIBM School of Computing Roster System',
    ].join('\n');
  };

  const buildGroupSummary = (): string => {
    const lines: string[] = [
      '📋 *NIBM FACULTY WEEKLY ROSTER*',
      `Week: ${planningStartDate} → ${weekDays[6]?.dateStr}`,
      `Status: ${rosterWeek.status}`,
      '',
    ];
    allInstructors.forEach((inst) => {
      const entries = getInstructorWeekEntries(inst.id);
      lines.push(`*${inst.fullName}*`);
      if (entries.length === 0) {
        lines.push('  Free / Standby all week');
      } else {
        entries.forEach((d) => {
          d.items.forEach((item) => lines.push(`  ${d.dayName} ${item}`));
        });
      }
      lines.push('');
    });
    lines.push('Generated via NIBM Instructor Roster System');
    return lines.join('\n');
  };

  const getWhatsAppLink = (inst: User): string | null => {
    if (!inst.phone) return null;
    const digits = normalizePhoneForWhatsApp(inst.phone);
    if (!digits) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(buildIndividualMessage(inst))}`;
  };

  const handleCopyGroupSummary = async () => {
    try {
      await navigator.clipboard.writeText(buildGroupSummary());
      setGroupCopied(true);
      setTimeout(() => setGroupCopied(false), 2500);
    } catch {
      await notify('Could not copy to clipboard. Please copy the summary manually.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Planner Studio Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Sunday Planning Studio • Demonstrator Console</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Weekly Task & Duty Allocator
            </h2>
          </div>

          {/* Roster Status & Action */}
          <div className="flex items-center flex-wrap gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
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
              onClick={() => setCatalogModalOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition-all bg-slate-700 hover:bg-slate-600 text-white cursor-pointer active:scale-95"
            >
              <LibraryBig className="w-3.5 h-3.5" />
              <span>Manage Catalog</span>
            </button>

            <button
              onClick={() => setDispatchOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition-all bg-[#25D366] hover:bg-[#20bd5a] text-slate-100 cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Dispatch via WhatsApp</span>
            </button>

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

          <button
            type="button"
            onClick={handleCloneWeek}
            disabled={isCloning}
            className="flex items-center space-x-1.5 text-xs bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Import all assignments from the preceding week into this draft"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            <span>{isCloning ? 'Cloning...' : 'Clone Previous Week'}</span>
          </button>
        </div>
      </div>

      {cloneMessage && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs flex items-center space-x-2">
          <CopyPlus className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{cloneMessage}</span>
        </div>
      )}

      {/* Workload Balancer Widget */}
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-200 text-sm">
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
                className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-800 text-center flex flex-col justify-between"
              >
                <div className="text-xs font-bold text-slate-200 truncate" title={inst.fullName}>
                  {inst.fullName.split(' ')[0]}
                </div>
                <div className="my-1.5 flex items-center justify-center space-x-2 text-xs">
                  <span className="bg-indigo-500/15 text-indigo-400 font-bold px-1.5 py-0.5 rounded text-[11px]" title="Teaching Slots">
                    {data.sessions} sess
                  </span>
                  <span className="bg-amber-500/15 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[11px]" title="Night Duty">
                    {data.nightShifts} 🌙
                  </span>
                </div>
                <div className="text-[10px] text-slate-300">
                  Total: {data.sessions + data.nightShifts} duties
                </div>
                {inst.phone && (
                  <a
                    href={`tel:${inst.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center justify-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-400 font-semibold mt-1 hover:underline cursor-pointer"
                    title={`Call ${inst.fullName}`}
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>{inst.phone}</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* The 7-Day Planning Matrix */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-200 text-base">Weekly Schedule Matrix</h3>
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
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {weekDays.map((day) => {
            const dayAssignments = dutyAssignments.filter((a) => a.dutyDate === day.dateStr);
            const nightShift = nightShifts.find((s) => s.shiftDate === day.dateStr);

            return (
              <div
                key={day.dateStr}
                className={`flex flex-col min-h-[560px] ${
                  day.isSunday ? 'bg-purple-500/10' : 'bg-slate-900'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 text-center border-b ${
                    day.isSunday
                      ? 'bg-purple-500/15 border-purple-500/20 text-purple-300 font-bold'
                      : 'bg-slate-800/60 border-slate-800 text-slate-200 font-bold'
                  }`}
                >
                  <div className="text-sm">{day.dayName}</div>
                  <div className="text-xs text-slate-500 font-normal">{day.formattedDate}</div>
                </div>

                {/* Slot 1: Morning (09:00 - 12:00) */}
                <div className="p-2 border-b border-slate-800 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                    <span className="text-emerald-400">09:00 - 12:00</span>
                    <button
                      onClick={() =>
                        handleOpenAddModal(
                          day.dateStr,
                          'Morning (09:00 - 12:00)',
                          '09:00',
                          '12:00'
                        )
                      }
                      className="p-1 hover:bg-emerald-500/15 text-emerald-400 rounded transition-colors"
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
                            className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-xs relative group shadow-2xs flex flex-col justify-between"
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
                                  className="p-1 text-emerald-400 hover:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 rounded transition-colors"
                                  title="Copy session to Afternoon (13:00 - 16:00)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteDuty(assignment.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 bg-slate-900/80 hover:bg-rose-500/10 rounded transition-colors"
                                title="Remove assignment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            <div>
                              <div className="font-bold text-emerald-300 truncate pr-12">
                                {assignment.instructorName}
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-400 truncate">
                                {assignment.batchName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
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
                                className="mt-2 w-full flex items-center justify-center space-x-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 py-1 px-1.5 rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Copy this session to Afternoon (13:00 - 16:00)"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy to Afternoon (1-4)</span>
                              </button>
                            ) : (
                              <div className="mt-1.5 text-[9px] font-semibold text-emerald-400/80 flex items-center space-x-1">
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
                <div className="p-2 border-b border-slate-800 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                    <span className="text-blue-400">13:00 - 16:00</span>
                    <button
                      onClick={() =>
                        handleOpenAddModal(
                          day.dateStr,
                          'Afternoon (13:00 - 16:00)',
                          '13:00',
                          '16:00'
                        )
                      }
                      className="p-1 hover:bg-blue-500/15 text-blue-400 rounded transition-colors"
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
                            className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-xs relative group shadow-2xs flex flex-col justify-between"
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
                                  className="p-1 text-blue-400 hover:text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 rounded transition-colors"
                                  title="Copy session to Morning (09:00 - 12:00)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteDuty(assignment.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 bg-slate-900/80 hover:bg-rose-500/10 rounded transition-colors"
                                title="Remove assignment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            <div>
                              <div className="font-bold text-blue-300 truncate pr-12">
                                {assignment.instructorName}
                              </div>
                              <div className="text-[11px] font-semibold text-blue-400 truncate">
                                {assignment.batchName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
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
                                className="mt-2 w-full flex items-center justify-center space-x-1 text-[10px] font-bold text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 py-1 px-1.5 rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Copy this session to Morning (09:00 - 12:00)"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy to Morning (9-12)</span>
                              </button>
                            ) : (
                              <div className="mt-1.5 text-[9px] font-semibold text-blue-400/80 flex items-center space-x-1">
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
                  <div className="p-2 border-b border-purple-500/20 bg-purple-500/10">
                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-400 mb-1">
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
                        className="p-1 hover:bg-purple-500/25 text-purple-400 rounded transition-colors"
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
                            className="bg-purple-500/15 border border-purple-500/20 rounded-lg p-2 text-xs relative group shadow-2xs"
                          >
                            <button
                              onClick={() => handleDeleteDuty(assignment.id)}
                              className="absolute top-1 right-1 p-1 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove assignment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="font-bold text-purple-300 truncate pr-3">
                              {assignment.instructorName}
                            </div>
                            <div className="text-[11px] font-semibold text-purple-400 truncate">
                              {assignment.batchName}
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
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
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Assign Teaching Duty</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalData.date} • {modalData.slotLabel}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-400 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDuty} className="mt-4 space-y-4">
              {/* Select Instructor */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Assigned Instructor (Cadre of 8)
                </label>
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="w-full text-sm bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Batch Code / Group
                </label>
                <input
                  type="text"
                  placeholder="e.g. DSE 24.1F or CCS Batch"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full text-sm border border-slate-700 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {catalog.batches.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBatchName(b)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module: pick from the catalog, type a custom one, or save a new one */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Module / Subject
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    list="module-catalog-options"
                    placeholder="e.g. Database Management Systems"
                    value={moduleName}
                    onChange={(e) => setModuleName(e.target.value)}
                    className="flex-1 min-w-0 text-sm bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  {moduleName.trim() &&
                    !catalog.modules.some((m) => m.toLowerCase() === moduleName.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={handleSaveModuleInline}
                        disabled={catalogBusy}
                        title="Save this module to the catalog permanently"
                        className="shrink-0 flex items-center gap-1 text-[11px] font-bold bg-slate-800 hover:bg-emerald-600 disabled:opacity-50 text-slate-300 hover:text-white px-2.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    )}
                </div>
                <datalist id="module-catalog-options">
                  {catalog.modules.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {catalog.modules.slice(0, 4).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModuleName(m)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md transition-colors truncate max-w-[200px]"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room/Lab: pick from the catalog, type a custom one, or save a new one */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Room / Lab Venue
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    list="room-catalog-options"
                    placeholder="e.g. Lab 01"
                    value={roomLab}
                    onChange={(e) => setRoomLab(e.target.value)}
                    className="flex-1 min-w-0 text-sm bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {roomLab.trim() &&
                    !catalog.rooms.some((r) => r.toLowerCase() === roomLab.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={handleSaveRoomInline}
                        disabled={catalogBusy}
                        title="Save this room/lab to the catalog permanently"
                        className="shrink-0 flex items-center gap-1 text-[11px] font-bold bg-slate-800 hover:bg-emerald-600 disabled:opacity-50 text-slate-300 hover:text-white px-2.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    )}
                </div>
                <datalist id="room-catalog-options">
                  {catalog.rooms.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {catalog.rooms.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoomLab(r)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Day / Duplicate Session Checkbox */}
              {modalData.startTime === '09:00' && (
                <label className="flex items-start space-x-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatForOtherSlot}
                    onChange={(e) => setRepeatForOtherSlot(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-300 block">
                      Also duplicate this session to Afternoon (13:00 - 16:00)
                    </span>
                    <span className="text-emerald-400 text-[11px] block mt-0.5">
                      Automatically books a full-day workshop/lab session with the same instructor, batch, module, and lab.
                    </span>
                  </div>
                </label>
              )}

              {modalData.startTime === '13:00' && (
                <label className="flex items-start space-x-2.5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatForOtherSlot}
                    onChange={(e) => setRepeatForOtherSlot(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-blue-300 block">
                      Also duplicate this session to Morning (09:00 - 12:00)
                    </span>
                    <span className="text-blue-400 text-[11px] block mt-0.5">
                      Automatically books a full-day workshop/lab session with the same instructor, batch, module, and lab.
                    </span>
                  </div>
                </label>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="text-xs font-bold text-slate-400 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition-colors"
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

      {/* WhatsApp Cadre Dispatcher Drawer */}
      {dispatchOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs">
          <button
            aria-label="Close dispatch drawer"
            onClick={() => setDispatchOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative bg-slate-900 w-full max-w-md h-full shadow-2xl border-l border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#075E54] text-white">
              <div>
                <div className="flex items-center space-x-2 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Cadre Dispatcher</span>
                </div>
                <h3 className="text-lg font-bold">Dispatch via WhatsApp</h3>
              </div>
              <button
                onClick={() => setDispatchOpen(false)}
                className="text-emerald-100 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-b border-slate-800 bg-slate-800/60">
              <p className="text-xs text-slate-500 mb-3">
                Copy a single formatted summary of the entire week&apos;s roster for posting to the NIBM Faculty WhatsApp group.
              </p>
              <button
                onClick={handleCopyGroupSummary}
                className={`w-full flex items-center justify-center space-x-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  groupCopied
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span>{groupCopied ? 'Copied to Clipboard!' : 'Copy Group Summary'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
              {allInstructors.map((inst) => {
                const link = getWhatsAppLink(inst);
                const entries = getInstructorWeekEntries(inst.id);
                const dutyCount = entries.reduce((sum, d) => sum + d.items.length, 0);
                return (
                  <div key={inst.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-100 truncate">{inst.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {dutyCount > 0 ? `${dutyCount} dut${dutyCount === 1 ? 'y' : 'ies'} this week` : 'Free / Standby this week'}
                      </div>
                      {inst.phone && (
                        <div className="text-[11px] text-slate-400">{inst.phone}</div>
                      )}
                    </div>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center space-x-1.5 text-[11px] font-bold bg-[#25D366] hover:bg-[#20bd5a] text-slate-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </a>
                    ) : (
                      <span className="shrink-0 text-[11px] text-slate-400 italic">No phone on file</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Academic Catalog Manager Modal */}
      {catalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <button
            aria-label="Close catalog manager"
            onClick={() => setCatalogModalOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <LibraryBig className="w-3.5 h-3.5" />
                  <span>Demonstrator Console</span>
                </div>
                <h3 className="text-lg font-bold text-slate-100">Academic Catalog Manager</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage the student batches, modules, and lecture rooms/labs offered as presets when assigning duties.
                </p>
              </div>
              <button
                onClick={() => setCatalogModalOpen(false)}
                className="text-slate-400 hover:text-slate-400 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {catalogError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{catalogError}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Batches Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Student Batches ({catalog.batches.length})
                </h4>
                <form onSubmit={handleAddBatch} className="flex gap-1.5 mb-3">
                  <input
                    type="text"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    placeholder="e.g. DSE 24.2F"
                    className="flex-1 min-w-0 text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={catalogBusy || !newBatchName.trim()}
                    className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {catalog.batches.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No batches yet. Add one above.</p>
                  ) : (
                    catalog.batches.map((b) =>
                      editingCatalogItem?.kind === 'batch' && editingCatalogItem.original === b ? (
                        <div
                          key={b}
                          className="flex items-center justify-between gap-1.5 bg-slate-800/60 border border-emerald-500/60 rounded-lg px-2.5 py-1.5"
                        >
                          <input
                            type="text"
                            value={editCatalogValue}
                            onChange={(e) => setEditCatalogValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCatalogItem();
                              if (e.key === 'Escape') handleCancelEditCatalogItem();
                            }}
                            autoFocus
                            className="flex-1 min-w-0 text-xs bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none"
                          />
                          <button
                            onClick={handleSaveEditCatalogItem}
                            disabled={catalogBusy}
                            className="shrink-0 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEditCatalogItem}
                            disabled={catalogBusy}
                            className="shrink-0 text-slate-400 hover:text-slate-200 disabled:opacity-50 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          key={b}
                          className="flex items-center justify-between bg-slate-800/60 border border-slate-800 rounded-lg px-2.5 py-1.5"
                        >
                          <span className="text-xs font-semibold text-slate-300 truncate">{b}</span>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <button
                              onClick={() => handleStartEditCatalogItem('batch', b)}
                              disabled={catalogBusy}
                              className="text-slate-400 hover:text-blue-400 disabled:opacity-50 cursor-pointer transition-colors"
                              title={`Edit ${b}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveBatch(b)}
                              disabled={catalogBusy}
                              className="text-slate-400 hover:text-rose-600 disabled:opacity-50 cursor-pointer transition-colors"
                              title={`Remove ${b}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              {/* Rooms/Labs Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Lecture Rooms / Labs ({catalog.rooms.length})
                </h4>
                <form onSubmit={handleAddRoom} className="flex gap-1.5 mb-3">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g. Lab 05"
                    className="flex-1 min-w-0 text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={catalogBusy || !newRoomName.trim()}
                    className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {catalog.rooms.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No rooms/labs yet. Add one above.</p>
                  ) : (
                    catalog.rooms.map((r) =>
                      editingCatalogItem?.kind === 'room' && editingCatalogItem.original === r ? (
                        <div
                          key={r}
                          className="flex items-center justify-between gap-1.5 bg-slate-800/60 border border-emerald-500/60 rounded-lg px-2.5 py-1.5"
                        >
                          <input
                            type="text"
                            value={editCatalogValue}
                            onChange={(e) => setEditCatalogValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCatalogItem();
                              if (e.key === 'Escape') handleCancelEditCatalogItem();
                            }}
                            autoFocus
                            className="flex-1 min-w-0 text-xs bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none"
                          />
                          <button
                            onClick={handleSaveEditCatalogItem}
                            disabled={catalogBusy}
                            className="shrink-0 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEditCatalogItem}
                            disabled={catalogBusy}
                            className="shrink-0 text-slate-400 hover:text-slate-200 disabled:opacity-50 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          key={r}
                          className="flex items-center justify-between bg-slate-800/60 border border-slate-800 rounded-lg px-2.5 py-1.5"
                        >
                          <span className="text-xs font-semibold text-slate-300 truncate">{r}</span>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <button
                              onClick={() => handleStartEditCatalogItem('room', r)}
                              disabled={catalogBusy}
                              className="text-slate-400 hover:text-blue-400 disabled:opacity-50 cursor-pointer transition-colors"
                              title={`Edit ${r}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveRoom(r)}
                              disabled={catalogBusy}
                              className="text-slate-400 hover:text-rose-600 disabled:opacity-50 cursor-pointer transition-colors"
                              title={`Remove ${r}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              {/* Modules/Subjects Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Modules / Subjects ({catalog.modules.length})
                </h4>
                <form onSubmit={handleAddModule} className="flex gap-1.5 mb-3">
                  <input
                    type="text"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="e.g. Cloud Computing Essentials"
                    className="flex-1 min-w-0 text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={catalogBusy || !newModuleName.trim()}
                    className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {catalog.modules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No modules yet. Add one above.</p>
                  ) : (
                    catalog.modules.map((m) =>
                      editingCatalogItem?.kind === 'module' && editingCatalogItem.original === m ? (
                        <div
                          key={m}
                          className="flex items-center justify-between gap-1.5 bg-slate-800/60 border border-emerald-500/60 rounded-lg px-2.5 py-1.5"
                        >
                          <input
                            type="text"
                            value={editCatalogValue}
                            onChange={(e) => setEditCatalogValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCatalogItem();
                              if (e.key === 'Escape') handleCancelEditCatalogItem();
                            }}
                            autoFocus
                            className="flex-1 min-w-0 text-xs bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none"
                          />
                          <button
                            onClick={handleSaveEditCatalogItem}
                            disabled={catalogBusy}
                            className="shrink-0 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEditCatalogItem}
                            disabled={catalogBusy}
                            className="shrink-0 text-slate-400 hover:text-slate-200 disabled:opacity-50 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          key={m}
                          className="flex items-center justify-between bg-slate-800/60 border border-slate-800 rounded-lg px-2.5 py-1.5"
                        >
                          <span className="text-xs font-semibold text-slate-300 truncate">{m}</span>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <button
                              onClick={() => handleStartEditCatalogItem('module', m)}
                              disabled={catalogBusy}
                              className="text-slate-400 hover:text-blue-400 disabled:opacity-50 cursor-pointer transition-colors"
                              title={`Edit ${m}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveModule(m)}
                              disabled={catalogBusy}
                              className="shrink-0 text-slate-400 hover:text-rose-600 disabled:opacity-50 cursor-pointer transition-colors"
                              title={`Remove ${m}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
