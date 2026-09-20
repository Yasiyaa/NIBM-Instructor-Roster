'use client';

import React, { useState } from 'react';
import { User, LeaveRequest } from '@/types';
import { Clock, Download } from 'lucide-react';
import { reviewLeaveAction } from '@/lib/actions';

interface LeaveManagementProps {
  currentUser: User;
  leaveRequests: LeaveRequest[];
  onRefresh: () => void;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({
  currentUser,
  leaveRequests,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [actionId, setActionId] = useState<string | null>(null);
  const [comment, setComment] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canApprove = currentUser.role === 'DEMONSTRATOR' || currentUser.role === 'EXECUTIVE';

  const handleExportLeaveCSV = () => {
    const rows = [
      [
        'Leave ID',
        'Instructor Name',
        'Start Date',
        'End Date',
        'Duration (Days)',
        'Reason',
        'Status',
        'Reviewed By',
        'Review Comment',
        'Requested At',
      ],
    ];

    leaveRequests.forEach((l) => {
      const d1 = new Date(l.startDate);
      const d2 = new Date(l.endDate);
      const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      rows.push([
        l.id,
        `"${(l.instructorName || '').replace(/"/g, '""')}"`,
        l.startDate,
        l.endDate,
        days.toString(),
        `"${(l.reason || '').replace(/"/g, '""')}"`,
        l.status,
        `"${(l.reviewedByName || '-').replace(/"/g, '""')}"`,
        `"${(l.reviewComment || '-').replace(/"/g, '""')}"`,
        l.createdAt || '-',
      ]);
    });

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NIBM_Leave_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredRequests = leaveRequests.filter((l) => {
    if (filter === 'ALL') return true;
    return l.status === filter;
  });

  const handleReview = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setIsProcessing(true);
    try {
      await reviewLeaveAction(leaveId, status, currentUser.id, comment.trim());
      setActionId(null);
      setComment('');
      onRefresh();
    } catch (err) {
      console.error('Error updating leave status:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-2xl p-6 text-white border border-amber-900/50 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-sm font-medium mb-1">
              <Clock className="w-4 h-4" />
              <span>Leave & Absence Authority</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Instructor Leave Management & Review
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Dual sign-off console: Demonstrator Yasith and Dr. Thisara have full authority to endorse or decline leave requests. Once approved, the conflict engine automatically blocks scheduling duties for that instructor.
            </p>
          </div>

          {/* Current Reviewer Identity Badge */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Reviewing Authority
            </span>
            <span className="text-sm font-bold text-amber-300">
              {currentUser.fullName} ({currentUser.role})
            </span>
            {!canApprove && (
              <span className="text-[10px] text-rose-400 block mt-0.5">
                (View-only: switch to Yasith or Dr. Thisara to approve)
              </span>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium mr-2">Filter by Status:</span>
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filter === st
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {st} ({leaveRequests.filter((l) => (st === 'ALL' ? true : l.status === st)).length})
            </button>
          ))}
        </div>
      </div>

      {/* Leave Requests Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base">
            Applications Record ({filteredRequests.length})
          </h3>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 hidden sm:inline">Sorted by submission date</span>
            <button
              onClick={handleExportLeaveCSV}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Download Leave Records as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No leave requests found for the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((leave) => (
              <div key={leave.id} className="p-5 hover:bg-slate-50/80 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-slate-900 text-base">{leave.instructorName}</span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          leave.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : leave.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                      <span>
                        Dates:{' '}
                        <strong className="text-slate-700">
                          {leave.startDate} {leave.startDate !== leave.endDate && `to ${leave.endDate}`}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>Submitted: {new Date(leave.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="text-xs text-slate-700 mt-2 bg-slate-100/70 p-2 rounded-lg border border-slate-200/60 inline-block max-w-xl">
                      <strong>Reason:</strong> {leave.reason}
                    </p>

                    {leave.reviewedByName && (
                      <div className="text-[11px] text-slate-500 mt-2">
                        Reviewed by <strong className="text-slate-700">{leave.reviewedByName}</strong>:{' '}
                        <span className="italic">&ldquo;{leave.reviewComment}&rdquo;</span>
                      </div>
                    )}
                  </div>

                  {/* Actions if Pending and user is Authorized */}
                  {leave.status === 'PENDING' && canApprove && (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {actionId === leave.id ? (
                        <div className="flex flex-col gap-2 bg-slate-100 p-3 rounded-xl border border-slate-200">
                          <input
                            type="text"
                            placeholder="Optional feedback notes..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setActionId(null)}
                              className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={() => handleReview(leave.id, 'REJECTED')}
                              className="text-xs font-bold text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-300 transition-colors"
                            >
                              Decline
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={() => handleReview(leave.id, 'APPROVED')}
                              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActionId(leave.id)}
                          className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl transition-all shadow-xs"
                        >
                          Review Application
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
