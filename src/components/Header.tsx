'use client';

import React from 'react';
import { User, Role } from '@/types';
import { Shield, Calendar, Users, Clock, LogOut, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: 'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves';
  onSelectTab: (tab: 'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves') => void;
  pendingLeavesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  activeTab,
  onSelectTab,
  pendingLeavesCount,
}) => {
  const isInstructor = currentUser.role === 'INSTRUCTOR';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isDemonstrator = currentUser.role === 'DEMONSTRATOR';

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      {/* Top Bar: Brand + Logged-in User Profile & Logout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Logo & Institute Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center font-black text-white shadow-inner tracking-wider">
              NIBM
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Instructor Roster & Task Allocation
                </h1>
                <span className="hidden sm:inline-block text-[11px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded border border-slate-700">
                  School of Computing
                </span>
              </div>
              <p className="text-xs text-slate-400">
                National Institute of Business Management
              </p>
            </div>
          </div>

          {/* User Profile Badge & Logout Button */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white ${
                  isDemonstrator
                    ? 'bg-emerald-600'
                    : isExecutive
                    ? 'bg-blue-600'
                    : 'bg-purple-600'
                }`}
              >
                {currentUser.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {currentUser.role === 'DEMONSTRATOR' && 'Demonstrator (Roster Master)'}
                  {currentUser.role === 'EXECUTIVE' && 'Executive / Director'}
                  {currentUser.role === 'INSTRUCTOR' && 'Technical Instructor'}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-900/40 hover:border-rose-700 border border-slate-700 px-3 py-2 rounded-xl transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role-Restricted Navigation Tabs */}
      <div className="bg-slate-950/70 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-2 overflow-x-auto py-1.5 text-sm">
          {/* TAB: INSTRUCTOR PORTAL (Visible ONLY to Instructors) */}
          {isInstructor && (
            <button
              onClick={() => onSelectTab('instructor')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'instructor'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Users className="w-4 h-4 text-purple-400" />
              <span>My Teaching Schedule & Leave Portal</span>
            </button>
          )}

          {/* TAB: DR. THISARA'S COCKPIT (Visible to Executive & Demonstrator) */}
          {(isExecutive || isDemonstrator) && (
            <button
              onClick={() => onSelectTab('executive')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all ${
                activeTab === 'executive'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Shield className="w-4 h-4 text-blue-400" />
              <span>{isExecutive ? "Today's Executive Cockpit" : 'Live Daily Status'}</span>
            </button>
          )}

          {/* TAB: ENTIRE WEEK MASTER SCHEDULE (Visible to Executive & Demonstrator) */}
          {(isExecutive || isDemonstrator) && (
            <button
              onClick={() => onSelectTab('weekly')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all ${
                activeTab === 'weekly'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Entire Week Schedule</span>
            </button>
          )}

          {/* TAB: SUNDAY PLANNING STUDIO (Visible ONLY to Yasith / Demonstrator) */}
          {isDemonstrator && (
            <button
              onClick={() => onSelectTab('planner')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all ${
                activeTab === 'planner'
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Sunday Planning Studio</span>
            </button>
          )}

          {/* TAB: LEAVE CENTRAL (Visible to Demonstrator & Executive for Approvals) */}
          {(isDemonstrator || isExecutive) && (
            <button
              onClick={() => onSelectTab('leaves')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all relative ${
                activeTab === 'leaves'
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Leave Approvals</span>
              {pendingLeavesCount > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full ml-1">
                  {pendingLeavesCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
