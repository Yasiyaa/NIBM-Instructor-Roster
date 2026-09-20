'use client';

import React, { useState } from 'react';
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
import { getAppData, logoutAction } from '@/lib/actions';

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
  const [data, setData] = useState(initialData);
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(() => defaultTabForRole(initialCurrentUser));
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(data.rosterWeek.startDate);

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

  const handleRefresh = async () => {
    try {
      const refreshed = await getAppData(selectedWeekStart);
      setData(refreshed);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

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
        onLoginSuccess={() => router.refresh()}
        onOpenPublicBoard={() => setIsPublicMode(true)}
      />
    );
  }

  // 3. Forced password change for admin-issued temp-password accounts
  if (currentUser.mustChangePassword) {
    return <ChangePasswordScreen currentUser={currentUser} onDone={() => router.refresh()} />;
  }

  const pendingLeaves = data.leaveRequests.filter((l) => l.status === 'PENDING');

  const isInstructor = currentUser.role === 'INSTRUCTOR';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isDemonstrator = currentUser.role === 'DEMONSTRATOR';
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased text-slate-100">
      {/* Header with Role Restraints */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        pendingLeavesCount={pendingLeaves.length}
      />

      {/* Main Container: Strictly Renders Authorized Views */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* 1. Instructor Portal: ONLY for Instructors */}
        {isInstructor && activeTab === 'instructor' && (
          <InstructorPortal
            allInstructors={data.instructors}
            dutyAssignments={data.dutyAssignments}
            nightShifts={data.nightShifts}
            leaveRequests={data.leaveRequests}
            rosterWeek={data.rosterWeek}
            onRefresh={handleRefresh}
          />
        )}

        {/* 2. Dr. Thisara's Executive Cockpit: For Executive & Demonstrator */}
        {(isExecutive || isDemonstrator) && activeTab === 'executive' && (
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

        {/* 3. Entire Week Master Schedule: For Executive & Demonstrator */}
        {(isExecutive || isDemonstrator) && activeTab === 'weekly' && (
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

        {/* 3. Yasith's Sunday Planning Studio: ONLY for Demonstrator */}
        {isDemonstrator && activeTab === 'planner' && (
          <SundayPlanner
            currentUser={currentUser}
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

        {/* 4. Leave Approvals Console: For Demonstrator & Executive */}
        {(isDemonstrator || isExecutive) && activeTab === 'leaves' && (
          <LeaveManagement
            currentUser={currentUser}
            leaveRequests={data.leaveRequests}
            onRefresh={handleRefresh}
          />
        )}

        {/* 5. Admin Console: ONLY for Admin */}
        {isAdmin && activeTab === 'admin' && <AdminUserManagement currentUser={currentUser} />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-500">
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
  );
};
