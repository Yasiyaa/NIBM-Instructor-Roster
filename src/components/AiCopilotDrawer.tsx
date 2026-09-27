'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  LeaveRequest,
  AiProposedDuty,
  AiConflictReport,
  AiSubstituteSuggestion,
} from '@/types';
import {
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  UserCheck,
  Send,
  Loader2,
  RefreshCw,
  Phone,
  ArrowRight,
} from 'lucide-react';
import {
  scanRosterHealthAction,
  generateAiScheduleAction,
  findAiSubstitutesAction,
  applyAiScheduleChangesAction,
} from '@/lib/actions';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rosterWeek: RosterWeek;
  dutyAssignments?: DutyAssignment[];
  nightShifts?: NightShift[];
  leaveRequests?: LeaveRequest[];
  allInstructors: User[];
  onRefresh: () => void;
  initialMode?: 'auto-schedule' | 'radar' | 'substitute';
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  rosterWeek,
  allInstructors,
  onRefresh,
  initialMode = 'auto-schedule',
}) => {
  const [activeTab, setActiveTab] = useState<'auto-schedule' | 'radar' | 'substitute'>(initialMode);

  // Auto-Schedule State
  const [prompt, setPrompt] = useState('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposedChanges, setProposedChanges] = useState<AiProposedDuty[]>([]);
  const [selectedChangeIds, setSelectedChangeIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ count: number; errors: string[] } | null>(null);

  // Conflict Radar State
  const [radarReport, setRadarReport] = useState<AiConflictReport | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);

  // Substitute Finder State
  const [subDate, setSubDate] = useState<string>(rosterWeek.startDate);
  const [subTime, setSubTime] = useState<string>('09:00');
  const [subAbsentId, setSubAbsentId] = useState<string>('');
  const [subLoading, setSubLoading] = useState(false);
  const [substitutes, setSubstitutes] = useState<AiSubstituteSuggestion[]>([]);

  // Keyboard shortcut listener for Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch live radar report
  const fetchRadar = useCallback(async () => {
    setRadarLoading(true);
    try {
      const report = await scanRosterHealthAction(rosterWeek.id);
      setRadarReport(report);
    } catch (err) {
      console.error('Failed to scan roster health:', err);
    } finally {
      setRadarLoading(false);
    }
  }, [rosterWeek.id]);

  useEffect(() => {
    if (isOpen && activeTab === 'radar') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRadar();
    }
  }, [isOpen, activeTab, fetchRadar]);

  // Generate proposed AI schedule
  const handleGenerate = async (customPrompt?: string) => {
    setIsGenerating(true);
    setApplyResult(null);
    try {
      const res = await generateAiScheduleAction(
        rosterWeek.id,
        customPrompt !== undefined ? customPrompt : prompt,
        targetDate || undefined
      );

      if (res.success && res.proposed) {
        setProposedChanges(res.proposed);
        // Default select all proposed changes
        setSelectedChangeIds(new Set(res.proposed.map((p) => p.id)));
      }
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle selection for a proposed change
  const toggleSelectChange = (id: string) => {
    setSelectedChangeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllChanges = () => {
    setSelectedChangeIds(new Set(proposedChanges.map((p) => p.id)));
  };

  const deselectAllChanges = () => {
    setSelectedChangeIds(new Set());
  };

  // Apply selected changes to database
  const handleApplyChanges = async () => {
    const toApply = proposedChanges.filter((p) => selectedChangeIds.has(p.id));
    if (toApply.length === 0) return;

    setIsApplying(true);
    try {
      const res = await applyAiScheduleChangesAction(rosterWeek.id, toApply);
      setApplyResult({ count: res.appliedCount, errors: res.errors });
      if (res.appliedCount > 0) {
        onRefresh();
        // Remove applied items from preview
        setProposedChanges([]);
        setSelectedChangeIds(new Set());
      }
    } catch (err) {
      console.error('Failed to apply AI changes:', err);
    } finally {
      setIsApplying(false);
    }
  };

  // Find substitutes for emergency/leave
  const handleFindSubstitutes = async () => {
    if (!subAbsentId) return;
    setSubLoading(true);
    try {
      const res = await findAiSubstitutesAction(subDate, subTime, subAbsentId, rosterWeek.id);
      if (res.success && res.suggestions) {
        setSubstitutes(res.suggestions);
      }
    } catch (err) {
      console.error('Failed to find substitutes:', err);
    } finally {
      setSubLoading(false);
    }
  };

  // Quick 1-click substitute assign
  const handleQuickAssignSubstitute = async (sub: AiSubstituteSuggestion) => {
    setIsApplying(true);
    try {
      const singleChange: AiProposedDuty = {
        id: `sub-${sub.instructor.id}-${subDate}-${subTime}`,
        action: 'CREATE',
        dutyDate: subDate,
        slotLabel: subTime === '09:00' ? 'Morning (09:00 - 12:00)' : subTime === '13:00' ? 'Afternoon (13:00 - 16:00)' : 'Sunday CCS (16:30 - 17:30)',
        startTime: subTime,
        endTime: subTime === '09:00' ? '12:00' : subTime === '13:00' ? '16:00' : '17:30',
        instructorId: sub.instructor.id,
        instructorName: sub.instructor.fullName,
        dutyType: 'Teaching Duty',
        batchName: 'Cover Duty',
        notes: `Assigned as emergency substitute replacement via AI Co-Pilot`,
        reason: sub.matchReason,
      };

      const res = await applyAiScheduleChangesAction(rosterWeek.id, [singleChange]);
      if (res.appliedCount > 0) {
        onRefresh();
        setApplyResult({ count: 1, errors: [] });
      }
    } catch (err) {
      console.error('Substitute assignment error:', err);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-white animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Co-Pilot Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  AI Roster Co-Pilot
                </h3>
                <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Hybrid Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated conflict-free scheduling & intelligent standby suggestions
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline text-[10px] text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700 font-mono">
              ESC
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Co-Pilot Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Mode Tabs */}
        <div className="px-4 sm:px-5 pt-3 border-b border-slate-800 bg-slate-900/60 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'auto-schedule', label: '✨ Auto-Schedule' },
            { id: 'radar', label: '🛡️ Conflict Radar' },
            { id: 'substitute', label: '🔄 Substitute Finder' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* TAB 1: AUTO-SCHEDULE */}
          {activeTab === 'auto-schedule' && (
            <div className="space-y-4">
              {/* Quick Prompt Chips */}
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Quick Actions:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Auto-fill all unassigned slots', query: 'Auto-fill all unassigned slots' },
                    { label: 'Balance teaching hours equally', query: 'Balance teaching hours equally' },
                    { label: 'Fill overnight night duties', query: 'Assign night duties only' },
                    { label: 'Fill Sunday CCS session', query: 'Assign Sunday CCS session' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => {
                        setPrompt(chip.query);
                        handleGenerate(chip.query);
                      }}
                      className="text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Natural Language Prompt Input */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Custom Instruction (Optional):</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <select
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="bg-slate-900 text-slate-200 text-xs rounded border border-slate-700 px-2 py-0.5 focus:outline-none"
                    >
                      <option value="">Full 7-Day Week</option>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const d = new Date(rosterWeek.startDate);
                        d.setDate(d.getDate() + i);
                        const str = d.toISOString().split('T')[0];
                        return (
                          <option key={str} value={str}>
                            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Prioritize Sandali on Monday, keep Friday morning open..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerate();
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Generate</span>
                  </button>
                </div>
              </div>

              {/* Status / Success Toast */}
              {applyResult && (
                <div
                  className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
                    applyResult.count > 0
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Successfully committed {applyResult.count} changes to the roster week!
                  </span>
                </div>
              )}

              {/* Proposed Changes Diff Checklist */}
              {proposedChanges.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Proposed Changes ({selectedChangeIds.size} of {proposedChanges.length} Selected)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Review the staged additions below before committing to the schedule.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        onClick={selectAllChanges}
                        className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        onClick={deselectAllChanges}
                        className="text-slate-400 hover:text-slate-300 underline font-medium cursor-pointer"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {proposedChanges.map((change) => {
                      const isSelected = selectedChangeIds.has(change.id);
                      return (
                        <div
                          key={change.id}
                          onClick={() => toggleSelectChange(change.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                            isSelected
                              ? 'bg-slate-800/90 border-blue-500/50 shadow-xs'
                              : 'bg-slate-800/40 border-slate-700/60 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectChange(change.id)}
                            className="mt-1 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-white truncate">
                                {change.moduleName ?? change.dutyType}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  change.dutyType === 'Night Shift'
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {change.dutyType === 'Night Shift' ? '🌙 Night Shift' : '+ New Lecture'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {change.dutyDate}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {change.startTime} - {change.endTime}
                              </span>
                              {change.roomLab && (
                                <>
                                  <span>•</span>
                                  <span>{change.roomLab}</span>
                                </>
                              )}
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-1.5 font-bold text-blue-300">
                                <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[9px]">
                                  {change.instructorName.substring(0, 1)}
                                </div>
                                <span>{change.instructorName}</span>
                              </div>

                              <span className="text-[10px] text-slate-400 italic">
                                {change.reason}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleApplyChanges}
                      disabled={isApplying || selectedChangeIds.size === 0}
                      className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-98"
                    >
                      {isApplying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Commit {selectedChangeIds.size} Changes to Roster</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONFLICT RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Roster Health & Clash Scanner
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Live detection of double-bookings, leave clashes, and workload variance.
                  </p>
                </div>
                <button
                  onClick={fetchRadar}
                  disabled={radarLoading}
                  className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${radarLoading ? 'animate-spin' : ''}`} />
                  <span>Rescan</span>
                </button>
              </div>

              {radarReport && (
                <div className="space-y-3">
                  {/* Metric Summary Banner */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Unassigned Lecture Slots
                      </div>
                      <div className="text-2xl font-black text-amber-400 mt-0.5">
                        {radarReport.unassignedSlotsCount}
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Unstaffed Night Duties
                      </div>
                      <div className="text-2xl font-black text-indigo-400 mt-0.5">
                        {radarReport.unassignedNightShiftsCount} / 7
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Callout */}
                  {radarReport.recommendations.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Optimization Insights</span>
                      </div>
                      {radarReport.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-slate-300">
                          <span className="text-blue-400 font-bold">•</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Conflicts List */}
                  {radarReport.conflicts.length === 0 ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      <div className="text-xs font-bold text-emerald-300">Zero Schedule Clashes Detected!</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        No double-bookings or leave collision violations across the 7-day period.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[11px] uppercase font-bold text-rose-400 tracking-wider">
                        Detected Conflicts ({radarReport.conflicts.length}):
                      </span>
                      {radarReport.conflicts.map((c, i) => (
                        <div
                          key={i}
                          className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-xs flex items-start space-x-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-rose-300">{c.description}</div>
                            <div className="text-[10px] text-rose-200 mt-0.5">Date: {c.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cadre Workload Balance Meter */}
                  <div className="pt-2">
                    <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                      Cadre Workload Distribution:
                    </span>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {radarReport.workloadImbalances.map((w) => (
                        <div
                          key={w.instructorId}
                          className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div className="font-bold text-slate-200 truncate pr-2">
                            {w.instructorName}
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-slate-400">{w.sessionCount} sessions ({w.teachingHours}h)</span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                w.status === 'OVERLOAD'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : w.status === 'UNDERLOAD'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {w.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUBSTITUTE FINDER */}
          {activeTab === 'substitute' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Emergency Standby & Substitute Matcher
                </h4>
                <p className="text-[11px] text-slate-400">
                  Select an absent instructor to find the most suitable, conflict-free replacements.
                </p>
              </div>

              {/* Selector Bar */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Slot Date:
                    </label>
                    <input
                      type="date"
                      value={subDate}
                      onChange={(e) => setSubDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Time Slot:
                    </label>
                    <select
                      value={subTime}
                      onChange={(e) => setSubTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="09:00">Morning (09:00 - 12:00)</option>
                      <option value="13:00">Afternoon (13:00 - 16:00)</option>
                      <option value="16:30">Sunday CCS (16:30 - 17:30)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Absent Instructor:
                    </label>
                    <select
                      value={subAbsentId}
                      onChange={(e) => setSubAbsentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="">Select Instructor...</option>
                      {allInstructors
                        .filter((u) => u.isActive && u.username !== 'instructors')
                        .map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.fullName}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleFindSubstitutes}
                  disabled={subLoading || !subAbsentId}
                  className="w-full flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {subLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  <span>Rank Best Substitutes</span>
                </button>
              </div>

              {/* Substitutes Results List */}
              {substitutes.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                    Eligible Standby Instructors ({substitutes.length}):
                  </span>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {substitutes.map((sub, idx) => (
                      <div
                        key={sub.instructor.id}
                        className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center justify-between text-xs hover:border-blue-500/60 transition-all"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-black flex items-center justify-center text-[11px] shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate flex items-center gap-1.5">
                              <span>{sub.instructor.fullName}</span>
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                                {sub.score}% Match
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {sub.matchReason}
                            </div>
                            {sub.instructor.phone && (
                              <a
                                href={`tel:${sub.instructor.phone.replace(/\s+/g, '')}`}
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline mt-0.5"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                <span>{sub.instructor.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleQuickAssignSubstitute(sub)}
                          disabled={isApplying}
                          className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                          title="Assign as substitute"
                        >
                          <span>Assign</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
