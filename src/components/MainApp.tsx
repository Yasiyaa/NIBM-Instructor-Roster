'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest, ExecutiveStatusReport, AcademicCatalog } from '@/types';
import { Header, AppTab } from '@/components/Header';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { SundayPlanner } from '@/components/SundayPlanner';
import { InstructorPortal } from '@/components/InstructorPortal';
import { LeaveManagement } from '@/components/LeaveManagement';
import { LoginPage } from '@/components/LoginPage';
import { PublicStatusBoard } from '@/components/PublicStatusBoard';
import { WeeklyScheduleView } from '@/components/WeeklyScheduleView';
import { ChangePasswordScreen } from '@/components/ChangePasswordScreen';
import { AdminUserManagement } from '@/components/AdminUserManagement';
import { ProfileSettings } from '@/components/ProfileSettings';
import { DialogProvider } from '@/components/DialogProvider';
import { getAppData, logoutAction, updateAutoRefreshIntervalAction } from '@/lib/actions';

interface MainAppProps {
  initialData: {
    users: User[];
    instructors: User[];
    rosterWeek: RosterWeek;
    dutyAssignments: DutyAssignment[];
    nightShifts: NightShift[];
    leaveRequests: LeaveRequest[];
    executiveReport: ExecutiveStatusReport;
    catalog: AcademicCatalog;
  };
  initialCurrentUser: User | null;
}

function defaultTabForRole(user: User | null): AppTab {
  if (!user) return 'planner';
  if (user.role === 'INSTRUCTOR') return 'instructor';
  if (user.role === 'EXECUTIVE') return 'executive';
  if (user.role === 'ADMIN') return 'admin';
  return 'planner';
}

export const MainApp: React.FC<MainAppProps> = ({ initialData, initialCurrentUser }) => {
  const router = useRouter();
  // router.refresh() re-runs the server component (a handful of sequential
  // DB round-trips) but is otherwise invisible on its own -- useTransition
  // gives us `isSessionRefreshing` so login/password-change/profile screens
  // can keep showing a pending state for the *entire* refresh, not just the
  // fast server-action call that precedes it.
  const [isSessionRefreshing, startSessionRefresh] = useTransition();
  const refreshSession = () => startSessionRefresh(() => router.refresh());
  const [data, setData] = useState(initialData);
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(() => defaultTabForRole(initialCurrentUser));
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(data.rosterWeek.startDate);

  // Auto-refresh state (defaults to system setting in catalog, e.g. 5s)
  const defaultInterval = data.catalog.autoRefreshSeconds ?? 5;
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('slate_auto_refresh_seconds');
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    }
    return defaultInterval;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  // Handle changing refresh interval (admin can also update global system setting)
  const handleChangeRefreshInterval = async (seconds: number, updateGlobal = false) => {
    setAutoRefreshSeconds(seconds);
    if (typeof window !== 'undefined') {
      localStorage.setItem('slate_auto_refresh_seconds', seconds.toString());
    }
    if (updateGlobal && (initialCurrentUser?.role === 'ADMIN' || initialCurrentUser?.role === 'DEMONSTRATOR')) {
      try {
        await updateAutoRefreshIntervalAction(seconds);
      } catch (err) {
        console.error('Failed to update global auto-refresh setting:', err);
      }
    }
  };

  // The server resolves the session on every request; whenever a different
  // user arrives via props (login, logout, router.refresh()), reset the
  // active tab to that user's default landing tab.
  const [prevUserId, setPrevUserId] = useState<string | null>(initialCurrentUser?.id ?? null);
  if ((initialCurrentUser?.id ?? null) !== prevUserId) {
    setPrevUserId(initialCurrentUser?.id ?? null);
    setActiveTab(defaultTabForRole(initialCurrentUser));
  }

  const currentUser = initialCurrentUser;

  const handleLogout = async () => {
    await logoutAction();
  };

  const handleWeekChange = async (newStartDate: string) => {
    setSelectedWeekStart(newStartDate);
    try {
      const refreshed = await getAppData(newStartDate);
      setData(refreshed);
    } catch (err) {
      console.error('Failed to load week data:', err);
    }
  };

  const inFlightRef = useRef(false);

  const handleRefresh = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setIsRefreshing(true);
      const refreshed = await getAppData(selectedWeekStart);
      setData(refreshed);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  };

  // Background polling for sessions and night shifts (every N seconds)
  useEffect(() => {
    if (autoRefreshSeconds <= 0) return;

    let isMounted = true;
    const intervalMs = autoRefreshSeconds * 1000;

    const intervalId = setInterval(async () => {
      // Don't poll when tab is hidden in background
      if (typeof document !== 'undefined' && document.hidden) return;
      if (inFlightRef.current) return; // Prevent concurrent stacking
      inFlightRef.current = true;

      try {
        setIsRefreshing(true);
        const refreshed = await getAppData(selectedWeekStart);
        if (isMounted) {
          setData(refreshed);
          setLastRefreshedAt(new Date());
        }
      } catch (err) {
        console.error('Auto-refresh poll failed:', err);
      } finally {
        inFlightRef.current = false;
        if (isMounted) {
          setIsRefreshing(false);
        }
      }
    }, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [autoRefreshSeconds, selectedWeekStart]);

  // Immediate refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && autoRefreshSeconds > 0) {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
          setIsRefreshing(true);
          const refreshed = await getAppData(selectedWeekStart);
          setData(refreshed);
          setLastRefreshedAt(new Date());
        } catch (err) {
          console.error('Visibility refresh failed:', err);
        } finally {
          inFlightRef.current = false;
          setIsRefreshing(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoRefreshSeconds, selectedWeekStart]);

  // 1. Unauthenticated Public Status Board (No Login Required)
  if (isPublicMode) {
    return (
      <PublicStatusBoard
        initialReport={data.executiveReport}
        onOpenLogin={() => setIsPublicMode(false)}
      />
    );
  }

  // 2. Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={refreshSession}
        isRefreshing={isSessionRefreshing}
        onOpenPublicBoard={() => setIsPublicMode(true)}
      />
    );
  }

  // 3. Forced password change for admin-issued temp-password accounts
  if (currentUser.mustChangePassword) {
    return (
      <ChangePasswordScreen
        currentUser={currentUser}
        onDone={refreshSession}
        isRefreshing={isSessionRefreshing}
      />
    );
  }

  const pendingLeaves = data.leaveRequests.filter((l) => l.status === 'PENDING');

  const isInstructor = currentUser.role === 'INSTRUCTOR';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isDemonstrator = currentUser.role === 'DEMONSTRATOR';
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <DialogProvider>
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased text-slate-100 print:bg-white print:text-slate-900 print:min-h-0">
        {/* Header with Role Restraints */}
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          pendingLeavesCount={pendingLeaves.length}
          autoRefreshSeconds={autoRefreshSeconds}
          onChangeAutoRefreshSeconds={handleChangeRefreshInterval}
          isRefreshing={isRefreshing}
          onManualRefresh={handleRefresh}
          lastRefreshedAt={lastRefreshedAt}
        />

        {/* Main Container: Strictly Renders Authorized Views */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full print:max-w-none print:p-0 print:m-0 print:w-full">
          {/* 1. Instructor Portal: ONLY for Instructors */}
          {isInstructor && activeTab === 'instructor' && (
            <InstructorPortal
              currentUser={currentUser}
              allInstructors={data.instructors}
              dutyAssignments={data.dutyAssignments}
              nightShifts={data.nightShifts}
              leaveRequests={data.leaveRequests}
              rosterWeek={data.rosterWeek}
              onRefresh={handleRefresh}
            />
          )}

          {/* 2. Dr. Thisara's Executive Cockpit: For Executive, Demonstrator & Admin */}
          {(isExecutive || isDemonstrator || isAdmin) && activeTab === 'executive' && (
            <ExecutiveDashboard
              currentUser={currentUser}
              initialReport={data.executiveReport}
              pendingLeaves={pendingLeaves}
              allInstructors={data.instructors}
              rosterWeek={data.rosterWeek}
              dutyAssignments={data.dutyAssignments}
              nightShifts={data.nightShifts}
              leaveRequests={data.leaveRequests}
              onRefresh={handleRefresh}
              onWeekChange={handleWeekChange}
              initialViewMode="daily"
            />
          )}

          {/* 3. Entire Week Master Schedule: For Executive, Demonstrator & Admin */}
          {(isExecutive || isDemonstrator || isAdmin) && activeTab === 'weekly' && (
            <WeeklyScheduleView
              rosterWeek={data.rosterWeek}
              dutyAssignments={data.dutyAssignments}
              nightShifts={data.nightShifts}
              leaveRequests={data.leaveRequests}
              allInstructors={data.instructors}
              onWeekChange={handleWeekChange}
              onSelectDateForCockpit={() => {
                setActiveTab('executive');
              }}
            />
          )}

          {/* 3. Yasith's Sunday Planning Studio: For Demonstrator & Admin */}
          {(isDemonstrator || isAdmin) && activeTab === 'planner' && (
            <SundayPlanner
              rosterWeek={data.rosterWeek}
              dutyAssignments={data.dutyAssignments}
              nightShifts={data.nightShifts}
              leaveRequests={data.leaveRequests}
              allInstructors={data.instructors}
              catalog={data.catalog}
              onRefresh={handleRefresh}
              onWeekChange={handleWeekChange}
            />
          )}

          {/* 4. Leave Approvals Console: For Demonstrator, Executive & Admin */}
          {(isDemonstrator || isExecutive || isAdmin) && activeTab === 'leaves' && (
            <LeaveManagement
              currentUser={currentUser}
              leaveRequests={data.leaveRequests}
              onRefresh={handleRefresh}
            />
          )}

          {/* 5. Admin Console: ONLY for Admin */}
          {isAdmin && activeTab === 'admin' && <AdminUserManagement currentUser={currentUser} />}

          {/* 6. My Profile: every signed-in user can edit their own contact info */}
          {activeTab === 'profile' && (
            <ProfileSettings
              currentUser={currentUser}
              onUpdated={refreshSession}
              isRefreshing={isSessionRefreshing}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-500 print:hidden">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              NIBM Academic & Technical Operations System • SOC / IT Division
            </span>
            <span className="font-medium text-slate-400">
              Role: {currentUser.role} • Logged in as {currentUser.fullName}
            </span>
          </div>
        </footer>
      </div>
    </DialogProvider>
  );
};
