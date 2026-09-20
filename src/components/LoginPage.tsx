'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { Lock, Mail, ArrowRight, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { loginAction } from '@/lib/actions';

interface LoginPageProps {
  allUsers: User[];
  onLoginSuccess: (user: User) => void;
  onOpenPublicBoard: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  allUsers,
  onLoginSuccess,
  onOpenPublicBoard,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const yasith = allUsers.find((u) => u.email === 'yasith@nibm.lk');
  const kithnuka = allUsers.find((u) => u.email === 'kithnuka@nibm.lk');
  const thisara = allUsers.find((u) => u.email === 'thisara@nibm.lk');
  const generalInstructor = allUsers.find((u) => u.id === 'general-instructor') || allUsers.find((u) => u.role === 'INSTRUCTOR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await loginAction({
        email: email.trim().toLowerCase(),
        password,
      });

      if (!res.success || !res.user) {
        setError(res.error || 'Authentication failed');
      } else {
        onLoginSuccess(res.user as User);
      }
    } catch {
      setError('Network or server error during sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = async (targetUser?: User) => {
    if (!targetUser) return;
    setEmail(targetUser.email);
    setPassword('123');
    setIsLoading(true);
    setError(null);

    try {
      const res = await loginAction({
        email: targetUser.email,
        password: '123',
      });

      if (!res.success || !res.user) {
        setError(res.error || 'Sign in failed');
      } else {
        onLoginSuccess(res.user as User);
      }
    } catch {
      setError('Network or server error during quick sign in');
    } finally {
      setIsLoading(false);
    }
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
                    Public Operational Board
                  </span>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/40">
                    No Login Required
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Read-only live monitor view for campus lobby screens & staff room displays
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Or Sign In with Staff Account
            </span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3.5 flex items-start space-x-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold">Sign in error:</span> {error}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official Staff Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yasith@nibm.lk or thisara@nibm.lk"
                  required
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Default password for all staff accounts is <code className="bg-slate-700 px-1 py-0.5 rounded text-amber-300">123</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Access Demo Cards */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              1-Click Demo Profiles (Neon Database Connected)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Yasith */}
              <button
                type="button"
                onClick={() => handleQuickFill(yasith)}
                className="bg-slate-900/60 hover:bg-slate-700/60 border border-emerald-600/30 hover:border-emerald-500 p-2.5 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-xs text-white group-hover:text-emerald-300 truncate">
                    Yasith
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Demonstrator</div>
              </button>

              {/* Kithnuka */}
              <button
                type="button"
                onClick={() => handleQuickFill(kithnuka)}
                className="bg-slate-900/60 hover:bg-slate-700/60 border border-emerald-600/30 hover:border-emerald-500 p-2.5 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-xs text-white group-hover:text-emerald-300 truncate">
                    Kithnuka
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Demonstrator</div>
              </button>

              {/* Dr. Thisara */}
              <button
                type="button"
                onClick={() => handleQuickFill(thisara)}
                className="bg-slate-900/60 hover:bg-slate-700/60 border border-blue-600/30 hover:border-blue-500 p-2.5 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="font-bold text-xs text-white group-hover:text-blue-300 truncate">
                    Dr. Thisara
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Executive</div>
              </button>

              {/* Cadre Portal */}
              <button
                type="button"
                onClick={() => handleQuickFill(generalInstructor)}
                className="bg-slate-900/60 hover:bg-slate-700/60 border border-purple-600/30 hover:border-purple-500 p-2.5 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-bold text-xs text-white group-hover:text-purple-300 truncate">
                    Instructors
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Cadre Portal</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
