'use client';

import React from 'react';
import { User } from '@/types';
import { Shield, Calendar, Users, Clock, LogOut, ShieldCheck } from 'lucide-react';
import { AppLogo } from './AppLogo';

export type AppTab = 'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves' | 'admin' | 'profile';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
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
  const isAdmin = currentUser.role === 'ADMIN';

  const tabClass = (isActive: boolean) =>
    `flex items-center space-x-2 px-3.5 py-2 rounded-md font-medium text-xs transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
    }`;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      {/* Top Bar: Brand + Logged-in User Profile & Logout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Logo & Institute Branding */}
          <div className="flex items-center space-x-3">
            <AppLogo className="h-9 w-9 shrink-0" />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white">
                  SLATE
                </h1>
                <span className="hidden sm:inline-block text-[11px] text-slate-500 font-medium">
                  School of Computing
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-500">
                Instructor Roster & Task Allocation • National Institute of Business Management
              </p>
            </div>
          </div>

          {/* User Profile Badge & Logout Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectTab('profile')}
              title="My Profile"
              className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-800/60 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center font-semibold text-xs text-slate-300 bg-slate-700">
                {currentUser.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-medium text-white leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-500">
                  {currentUser.jobTitle ||
                    (currentUser.role === 'DEMONSTRATOR' && 'Demonstrator (Roster Master)') ||
                    (currentUser.role === 'EXECUTIVE' && 'Executive / Director') ||
                    (currentUser.role === 'INSTRUCTOR' && 'Instructor') ||
                    (currentUser.role === 'ADMIN' && 'System Administrator')}
                </div>
              </div>
            </button>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-800 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role-Restricted Navigation Tabs */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-1 overflow-x-auto py-1.5 text-sm">
          {/* TAB: INSTRUCTOR PORTAL (Visible ONLY to Instructors) */}
          {isInstructor && (
            <button onClick={() => onSelectTab('instructor')} className={tabClass(activeTab === 'instructor')}>
              <Users className="w-4 h-4" />
              <span>My Teaching Schedule & Leave Portal</span>
            </button>
          )}

          {/* TAB: DR. THISARA'S COCKPIT (Visible to Executive, Demonstrator & Admin) */}
          {(isExecutive || isDemonstrator || isAdmin) && (
            <button onClick={() => onSelectTab('executive')} className={tabClass(activeTab === 'executive')}>
              <Shield className="w-4 h-4" />
              <span>{isExecutive ? "Today's Executive Cockpit" : 'Live Daily Status'}</span>
            </button>
          )}

          {/* TAB: ENTIRE WEEK MASTER SCHEDULE (Visible to Executive, Demonstrator & Admin) */}
          {(isExecutive || isDemonstrator || isAdmin) && (
            <button onClick={() => onSelectTab('weekly')} className={tabClass(activeTab === 'weekly')}>
              <Calendar className="w-4 h-4" />
              <span>Entire Week Schedule</span>
            </button>
          )}

          {/* TAB: SUNDAY PLANNING STUDIO (Visible to Demonstrator & Admin) */}
          {(isDemonstrator || isAdmin) && (
            <button onClick={() => onSelectTab('planner')} className={tabClass(activeTab === 'planner')}>
              <Calendar className="w-4 h-4" />
              <span>Sunday Planning Studio</span>
            </button>
          )}

          {/* TAB: LEAVE CENTRAL (Visible to Demonstrator, Executive & Admin for Approvals) */}
          {(isDemonstrator || isExecutive || isAdmin) && (
            <button onClick={() => onSelectTab('leaves')} className={`${tabClass(activeTab === 'leaves')} relative`}>
              <Clock className="w-4 h-4" />
              <span>Leave Approvals</span>
              {pendingLeavesCount > 0 && (
                <span className="bg-indigo-500 text-white font-semibold text-[10px] leading-none px-1.5 py-1 rounded-full ml-1">
                  {pendingLeavesCount}
                </span>
              )}
            </button>
          )}

          {/* TAB: ADMIN CONSOLE (Visible ONLY to Admin) */}
          {isAdmin && (
            <button onClick={() => onSelectTab('admin')} className={tabClass(activeTab === 'admin')}>
              <ShieldCheck className="w-4 h-4" />
              <span>Staff & Access Management</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
