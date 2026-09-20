'use client';

import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, Eye, AlertCircle } from 'lucide-react';
import { loginAction } from '@/lib/actions';
import { AppLogo } from './AppLogo';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onOpenPublicBoard: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onOpenPublicBoard }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await loginAction(username, password);
    setSubmitting(false);

    if (!res.success) {
      setError(res.error);
      return;
    }
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        {/* NIBM Emblem */}
        <AppLogo className="mx-auto h-11 w-11" />
        <h1 className="mt-4 text-xl font-semibold text-white tracking-tight">
          SLATE
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Instructor Roster Portal • School of Computing, NIBM
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm px-4 sm:px-0">
        <div className="bg-slate-900 py-7 px-6 shadow-sm rounded-xl border border-slate-800 space-y-5">
          {/* PUBLIC ACCESS BUTTON (NO LOGIN REQUIRED) */}
          <button
            type="button"
            onClick={onOpenPublicBoard}
            className="w-full text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700 p-3.5 rounded-lg transition-colors group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-slate-100 text-sm">
                  View Live Status Board
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  No login required
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="absolute bg-slate-900 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Staff Sign In
            </span>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="yourusername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            >
              <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          SLATE • NIBM Technical Cadre Operational System
        </p>
      </div>
    </div>
  );
};
