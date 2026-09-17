'use client';

import React, { useState } from 'react';
import { User, Role } from '@/types';
import { Shield, Sparkles, Users, Lock, Mail, ArrowRight, Eye, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  allUsers: User[];
  onLogin: (user: User) => void;
  onOpenPublicBoard: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  allUsers,
  onLogin,
  onOpenPublicBoard,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const yasith = allUsers.find((u) => u.role === 'DEMONSTRATOR');
  const thisara = allUsers.find((u) => u.role === 'EXECUTIVE');
  const generalInstructor = allUsers.find((u) => u.id === 'general-instructor') || allUsers.find((u) => u.role === 'INSTRUCTOR');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const inputEmail = email.trim().toLowerCase();

    // Check credentials matching user request:
    // dr thisra using thisara@nibm.lk pw - 123
    // yasith@nibm pw - 123 (accepts yasith@nibm.lk or yasith@nibm)
    // instructors@nibm pw - 123 (accepts instructors@nibm.lk or instructors@nibm)
    let matchedUser: User | undefined;

    if (inputEmail === 'thisara@nibm.lk' || inputEmail === 'thisara@nibm') {
      matchedUser = thisara;
    } else if (inputEmail === 'yasith@nibm.lk' || inputEmail === 'yasith@nibm') {
      matchedUser = yasith;
    } else if (inputEmail === 'instructors@nibm.lk' || inputEmail === 'instructors@nibm') {
      matchedUser = generalInstructor;
    } else {
      matchedUser = allUsers.find((u) => u.email.toLowerCase() === inputEmail);
    }

    if (!matchedUser) {
      setError('Staff email not recognized. Valid accounts: thisara@nibm.lk, yasith@nibm.lk, or instructors@nibm.lk');
      return;
    }

    if (password !== '123') {
      setError('Invalid password. Password is: 123');
      return;
    }

    onLogin(matchedUser);
  };

  const handleQuickLogin = (targetUser: User) => {
    setEmail(targetUser.email);
    setPassword('123');
    onLogin(targetUser);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center">
        {/* NIBM Emblem */}
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/20">
          NIBM
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-black text-white tracking-tight">
          Instructor Roster Portal
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          National Institute of Business Management • School of Computing
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4 sm:px-0">
        <div className="bg-slate-800/90 backdrop-blur-md py-7 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-700 space-y-6">
          {/* PUBLIC ACCESS BUTTON (NO LOGIN REQUIRED) */}
          <button
            type="button"
            onClick={onOpenPublicBoard}
            className="w-full text-left bg-gradient-to-r from-blue-900/60 to-indigo-900/60 hover:from-blue-900/80 hover:to-indigo-900/80 border border-blue-500/40 hover:border-blue-400 p-4 rounded-2xl transition-all group shadow-md cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">
                    View Live Status Board
                  </span>
                  <span className="text-[10px] font-black bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 uppercase">
                    No Login Required
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  See who is on duty, who is free, who is on leave, and tonight's night duty
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-700 w-full" />
            <span className="bg-slate-800 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Or Staff Sign In
            </span>
          </div>

          {/* Standard Email / Password Form (Password: 123) */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="thisara@nibm.lk, yasith@nibm.lk, or instructors@nibm.lk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm bg-slate-900/80 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] font-semibold text-amber-400">Password is: 123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  placeholder="Enter 123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm bg-slate-900/80 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Sign-In Buttons */}
          <div className="pt-2 border-t border-slate-700/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              1-Click Fast Sign In (Auto-fills Password: 123):
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Yasith */}
              {yasith && (
                <button
                  type="button"
                  onClick={() => handleQuickLogin(yasith)}
                  className="text-left bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 p-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px]">
                    <Sparkles className="w-3 h-3" />
                    <span>Yasith</span>
                  </div>
                  <div className="text-[10px] text-slate-400">yasith@nibm.lk (pw: 123)</div>
                </button>
              )}

              {/* Dr. Thisara */}
              {thisara && (
                <button
                  type="button"
                  onClick={() => handleQuickLogin(thisara)}
                  className="text-left bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/60 p-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-1.5 text-blue-400 font-bold text-[11px]">
                    <Shield className="w-3 h-3" />
                    <span>Dr. Thisara</span>
                  </div>
                  <div className="text-[10px] text-slate-400">thisara@nibm.lk (pw: 123)</div>
                </button>
              )}

              {/* Instructors */}
              {generalInstructor && (
                <button
                  type="button"
                  onClick={() => handleQuickLogin(generalInstructor)}
                  className="text-left bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 p-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-1.5 text-purple-400 font-bold text-[11px]">
                    <Users className="w-3 h-3" />
                    <span>Instructors</span>
                  </div>
                  <div className="text-[10px] text-slate-400">instructors@nibm.lk (pw: 123)</div>
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          NIBM Technical Cadre Operational System • Password for all accounts: 123
        </p>
      </div>
    </div>
  );
};
