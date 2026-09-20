'use client';

import React, { useState } from 'react';
import { Mail, Phone, Lock, CheckCircle2, AlertCircle, UserCircle } from 'lucide-react';
import { User } from '@/types';
import { updateProfileAction, changePasswordAction } from '@/lib/actions';

const ROLE_LABELS: Record<User['role'], string> = {
  ADMIN: 'System Administrator',
  DEMONSTRATOR: 'Demonstrator (Roster Master)',
  EXECUTIVE: 'Executive / Director',
  INSTRUCTOR: 'Instructor',
  GUEST: 'Guest',
};

interface ProfileSettingsProps {
  currentUser: User;
  onUpdated: () => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdated }) => {
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(false);
    setSavingContact(true);
    const res = await updateProfileAction({ email, phone });
    setSavingContact(false);

    if (!res.success) {
      setContactError(res.error);
      return;
    }
    setContactSuccess(true);
    onUpdated();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    const res = await changePasswordAction(currentPassword, newPassword);
    setSavingPassword(false);

    if (!res.success) {
      setPasswordError(res.error || 'Failed to change password.');
      return;
    }
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
          <UserCircle className="w-3.5 h-3.5" />
          <span>My Profile</span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-white">{currentUser.fullName}</h2>
        <p className="text-slate-400 text-sm mt-1">
          @{currentUser.username} • {currentUser.jobTitle || ROLE_LABELS[currentUser.role]}
        </p>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Contact Information</h3>
        <form onSubmit={handleSaveContact} className="space-y-4">
          {contactError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{contactError}</span>
            </div>
          )}
          {contactSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Contact details saved.</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setContactSuccess(false);
                  }}
                  placeholder="you@nibm.lk"
                  className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setContactSuccess(false);
                  }}
                  placeholder="071 234 5678"
                  className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingContact}
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {savingContact ? 'Saving...' : 'Save Contact Info'}
          </button>
        </form>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center space-x-2">
          <Lock className="w-4 h-4 text-slate-400" />
          <span>Change Password</span>
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          {passwordError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{passwordError}</span>
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password changed.</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Password</label>
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
            disabled={savingPassword}
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {savingPassword ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
