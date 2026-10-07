'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User } from '@/types';
import { Shield, Calendar, Users, Clock, LogOut, Loader2, ShieldCheck, RefreshCw, Check, ChevronDown } from 'lucide-react';
import { AppLogo } from './AppLogo';

export type AppTab = 'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves' | 'admin' | 'profile';

interface HeaderProps {
  currentUser: User;
  onLogout: () => Promise<void>;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pendingLeavesCount: number;
  autoRefreshSeconds?: number;
  onChangeAutoRefreshSeconds?: (seconds: number, updateGlobal?: boolean) => Promise<void> | void;
  isRefreshing?: boolean;
  onManualRefresh?: () => Promise<void> | void;
  lastRefreshedAt?: Date;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  activeTab,
  onSelectTab,
  pendingLeavesCount,
  autoRefreshSeconds,
  onChangeAutoRefreshSeconds,
  isRefreshing,
  onManualRefresh,
  lastRefreshedAt,
}) => {
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close auto-refresh dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setRefreshMenuOpen(false);
      }
    };
    if (refreshMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refreshMenuOpen]);

  const refreshIntervalOptions = [
    { label: '5s (Recommended / Live)', value: 5 },
    { label: '10s', value: 10 },
    { label: '15s', value: 15 },
    { label: '30s', value: 30 },
    { label: '60s (1 min)', value: 60 },
    { label: 'Off (Manual only)', value: 0 },
  ];

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch {
      // logoutAction redirects on success (no error here); only a genuine
      // failure reaches this catch, so re-enable the button to allow retry.
      setLoggingOut(false);
    }
  };

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
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 print:hidden">
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
          <div className="flex items-center space-x-2.5">
            {/* Auto-Refresh Live Indicator & Selector */}
            {autoRefreshSeconds !== undefined && onChangeAutoRefreshSeconds && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setRefreshMenuOpen(!refreshMenuOpen)}
                  title="Configure auto-refresh interval"
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                    autoRefreshSeconds > 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                      : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {autoRefreshSeconds > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        autoRefreshSeconds > 0 ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    ></span>
                  </span>
                  <RefreshCw
                    className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`}
                  />
                  <span className="font-semibold hidden sm:inline">
                    {autoRefreshSeconds > 0 ? `${autoRefreshSeconds}s` : 'Off'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {refreshMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1.5 border-b border-slate-800 mb-1.5">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>Auto-Refresh Rate</span>
                        {isRefreshing && (
                          <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing...
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>Sessions update in background</span>
                        {lastRefreshedAt && (
                          <span className="text-slate-500 font-mono text-[9px]">
                            {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      {refreshIntervalOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onChangeAutoRefreshSeconds(opt.value, false);
                            setRefreshMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            autoRefreshSeconds === opt.value
                              ? 'bg-purple-600/20 text-purple-300 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {autoRefreshSeconds === opt.value && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </button>
                      ))}
                    </div>

                    {/* Admin Global Default Controls */}
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'DEMONSTRATOR') && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          disabled={savingGlobal}
                          onClick={async () => {
                            setSavingGlobal(true);
                            try {
                              await onChangeAutoRefreshSeconds(autoRefreshSeconds, true);
                            } finally {
                              setSavingGlobal(false);
                              setRefreshMenuOpen(false);
                            }
                          }}
                          className="w-full text-center py-1.5 px-2 bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {savingGlobal ? 'Saving...' : `Set ${autoRefreshSeconds}s as Default for All Users`}
                        </button>
                      </div>
                    )}

                    {/* Manual Refresh Now Button */}
                    {onManualRefresh && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            onManualRefresh();
                            setRefreshMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                          <span>Refresh Now</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
              onClick={handleLogoutClick}
              disabled={loggingOut}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-800 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sign Out"
            >
              {loggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{loggingOut ? 'Signing Out...' : 'Sign Out'}</span>
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
