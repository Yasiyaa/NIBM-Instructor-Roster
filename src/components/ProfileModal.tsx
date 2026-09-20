'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import {
  X,
  Phone,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
} from 'lucide-react';
import { updateProfilePasswordAction, updateProfilePhoneAction } from '@/lib/actions';

interface ProfileModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updated: Partial<User>) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  // Phone state
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneLoading(true);
    setPhoneError(null);
    setPhoneSuccess(null);

    try {
      const res = await updateProfilePhoneAction({ phone });
      if (res.success) {
        setPhoneSuccess('Phone number successfully updated');
        onProfileUpdated?.({ phone });
        setTimeout(() => setPhoneSuccess(null), 4000);
      } else {
        setPhoneError(res.error || 'Failed to update phone');
      }
    } catch {
      setPhoneError('An unexpected error occurred');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 3) {
      setPasswordError('New password must be at least 3 characters');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await updateProfilePasswordAction({
        currentPassword,
        newPassword,
      });
      if (res.success) {
        setPasswordSuccess('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(null), 4000);
      } else {
        setPasswordError(res.error || 'Failed to change password');
      }
    } catch {
      setPasswordError('An unexpected error occurred');
    } finally {
      setPasswordLoading(false);
    }
  };

  const roleLabel =
    currentUser.role === 'DEMONSTRATOR'
      ? 'Demonstrator (Roster Master)'
      : currentUser.role === 'EXECUTIVE'
      ? 'Executive Director'
      : 'Technical Instructor';

  const roleColor =
    currentUser.role === 'DEMONSTRATOR'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : currentUser.role === 'EXECUTIVE'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : 'bg-purple-50 text-purple-800 border-purple-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-lg text-emerald-400 shadow-inner">
              {currentUser.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{currentUser.fullName}</h2>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-900">
          {/* Role & Identification Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Assigned Authority
              </span>
              <span className="text-sm font-bold text-slate-900">{roleLabel}</span>
            </div>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${roleColor}`}>
              {currentUser.role}
            </span>
          </div>

          {/* Form 1: Phone & Contact Update */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm mb-3">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Contact Phone Number</span>
            </div>

            {phoneSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{phoneSuccess}</span>
              </div>
            )}

            {phoneError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{phoneError}</span>
              </div>
            )}

            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 071 257 0137"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Shown in the night shift callout and executive dashboard for emergency contact.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{phoneLoading ? 'Saving...' : 'Update Phone'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Form 2: Change Password */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm mb-3">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Change Account Password</span>
            </div>

            {passwordSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 3 characters"
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Security Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Credentials are authenticated with salted bcrypt and encrypted inside HTTP-only JWT cookies.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
