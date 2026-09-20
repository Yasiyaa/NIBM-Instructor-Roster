'use client';

import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { User } from '@/types';
import { changePasswordAction } from '@/lib/actions';

interface ChangePasswordScreenProps {
  currentUser: User;
  onDone: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ currentUser, onDone }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    const res = await changePasswordAction(currentPassword, newPassword);
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to change password.');
      return;
    }
    onDone();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <div className="mx-auto h-11 w-11 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-white tracking-tight">Set a New Password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Hi {currentUser.fullName.split(' ')[0]}, this account was created with a temporary password. Choose a new one to continue.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm px-4 sm:px-0">
        <div className="bg-slate-900 py-7 px-6 shadow-sm rounded-xl border border-slate-800 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Temporary Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            >
              <span>{submitting ? 'Saving...' : 'Set Password & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
