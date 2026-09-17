'use client';

import React, { useState, useEffect } from 'react';
import { User, RosterWeek, DutyAssignment, NightShift, LeaveRequest, ExecutiveStatusReport } from '@/types';
import { Header } from '@/components/Header';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { SundayPlanner } from '@/components/SundayPlanner';
import { InstructorPortal } from '@/components/InstructorPortal';
import { LeaveManagement } from '@/components/LeaveManagement';
import { LoginPage } from '@/components/LoginPage';
import { PublicStatusBoard } from '@/components/PublicStatusBoard';
import { WeeklyScheduleView } from '@/components/WeeklyScheduleView';
import { getAppData } from '@/lib/actions';

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
}

export const MainApp: React.FC<MainAppProps> = ({ initialData }) => {
  const [data, setData] = useState(initialData);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'executive' | 'weekly' | 'planner' | 'instructor' | 'leaves'>('planner');
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(data.rosterWeek.startDate);

  // Load saved session on client mount
  useEffect(() => {
    setIsClientLoaded(true);
    const savedUserId = localStorage.getItem('nibm_roster_user_id');
    if (savedUserId) {
      const found = initialData.users.find((u) => u.id === savedUserId);
      if (found) {
        handleUserLogin(found);
      }
    }
  }, [initialData.users]);

  const handleUserLogin = (user: User) => {
    setCurrentUser(user);
    setIsPublicMode(false);
    localStorage.setItem('nibm_roster_user_id', user.id);

    // Route to designated dashboard
    if (user.role === 'INSTRUCTOR') {
      setActiveTab('instructor');
    } else if (user.role === 'EXECUTIVE') {
      setActiveTab('executive');
    } else {
      setActiveTab('planner');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nibm_roster_user_id');
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

  if (!isClientLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        Loading NIBM System...
      </div>
    );
  }

  // 1. Unauthenticated Public Status Board (No Login Required)
  if (isPublicMode) {
    return (
      <PublicStatusBoard
        initialReport={data.executiveReport}
        allInstructors={data.instructors}
        onOpenLogin={() => setIsPublicMode(false)}
      />
    );
  }

  // 2. Login Page (Passes onOpenPublicBoard)
  if (!currentUser) {
    return (
      <LoginPage
        allUsers={data.users}
        onLogin={handleUserLogin}
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
            currentUser={currentUser}
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
            currentUser={currentUser}
            rosterWeek={data.rosterWeek}
            dutyAssignments={data.dutyAssignments}
            nightShifts={data.nightShifts}
            leaveRequests={data.leaveRequests}
            allInstructors={data.instructors}
            onRefresh={handleRefresh}
            onWeekChange={handleWeekChange}
            onSelectDateForCockpit={(dateStr) => {
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
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            NIBM Academic & Technical Operations System • SOC / IT Division
          </span>
          <span className="font-semibold text-slate-600">
            Role: {currentUser.role} • Logged in as {currentUser.fullName}
          </span>
        </div>
      </footer>
    </div>
  );
};
