'use client';

import React, { useState } from 'react';
import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest, ExecutiveStatusReport } from '@/types';
import { Header } from '@/components/Header';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { SundayPlanner } from '@/components/SundayPlanner';
import { InstructorPortal } from '@/components/InstructorPortal';
import { LeaveManagement } from '@/components/LeaveManagement';
import { LoginPage } from '@/components/LoginPage';
import { PublicStatusBoard } from '@/components/PublicStatusBoard';
import { WeeklyScheduleView } from '@/components/WeeklyScheduleView';
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
  };
  initialUser: User | null;
}

export const MainApp: React.FC<MainAppProps> = ({ initialData, initialUser }) => {
  const [data, setData] = useState(initialData);
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(data.rosterWeek.startDate);

  // Determine initial active tab based on role
  const getDefaultTab = (user: User | null): 'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves' => {
    if (!user) return 'planner';
    if (user.role === 'INSTRUCTOR') return 'instructor';
    if (user.role === 'EXECUTIVE') return 'executive';
    return 'planner';
  };

  const [activeTab, setActiveTab] = useState<'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves'>(
    getDefaultTab(initialUser)
  );

  const handleUserLogin = (user: User) => {
    setCurrentUser(user);
    setIsPublicMode(false);
    setActiveTab(getDefaultTab(user));
  };

  const handleLogout = async () => {
    await logoutAction();
    setCurrentUser(null);
    setIsPublicMode(false);
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

  // 1. Unauthenticated Public Status Board (Lobby Display View)
  if (isPublicMode) {
    return (
      <PublicStatusBoard
        initialReport={data.executiveReport}
        allInstructors={data.instructors}
        onOpenLogin={() => setIsPublicMode(false)}
      />
    );
  }

  // 2. Login Page (If not authenticated)
  if (!currentUser) {
    return (
      <LoginPage
        allUsers={data.users}
        onLoginSuccess={handleUserLogin}
        onOpenPublicBoard={() => setIsPublicMode(true)}
      />
    );
  }

  const pendingLeaves = data.leaveRequests.filter((l) => l.status === 'PENDING');
  const isInstructor = currentUser.role === 'INSTRUCTOR';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isDemonstrator = currentUser.role === 'DEMONSTRATOR';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">
      {/* Header with Server-Side Session Display */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        pendingLeavesCount={pendingLeaves.length}
        onProfileUpdated={(updated) => {
          setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null));
          handleRefresh();
        }}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* 1. Instructor Portal: Visible to Technical Cadre */}
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

        {/* 2. Dr. Thisara's Executive Cockpit: Visible to Executive & Demonstrator */}
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

        {/* 3. Entire Week Master Schedule: Visible to all authenticated staff */}
        {activeTab === 'weekly' && (
          <WeeklyScheduleView
            currentUser={currentUser}
            rosterWeek={data.rosterWeek}
            dutyAssignments={data.dutyAssignments}
            nightShifts={data.nightShifts}
            leaveRequests={data.leaveRequests}
            allInstructors={data.instructors}
            onRefresh={handleRefresh}
            onWeekChange={handleWeekChange}
            onSelectDateForCockpit={
              isExecutive || isDemonstrator ? () => setActiveTab('executive') : undefined
            }
          />
        )}

        {/* 4. Yasith's Sunday Planning Studio: Visible ONLY to Demonstrator */}
        {isDemonstrator && activeTab === 'planner' && (
          <SundayPlanner
            currentUser={currentUser}
            rosterWeek={data.rosterWeek}
            dutyAssignments={data.dutyAssignments}
            nightShifts={data.nightShifts}
            leaveRequests={data.leaveRequests}
            allInstructors={data.instructors}
            onRefresh={handleRefresh}
            onWeekChange={handleWeekChange}
          />
        )}

        {/* 5. Leave Approvals Console: Visible to Demonstrator & Executive */}
        {(isDemonstrator || isExecutive) && activeTab === 'leaves' && (
          <LeaveManagement
            currentUser={currentUser}
            leaveRequests={data.leaveRequests}
            onRefresh={handleRefresh}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            NIBM Academic & Technical Operations System • SOC / IT Division
          </span>
          <span className="font-semibold text-slate-600">
            Role: {currentUser.role} • Signed in as {currentUser.fullName}
          </span>
        </div>
      </footer>
    </div>
  );
};
