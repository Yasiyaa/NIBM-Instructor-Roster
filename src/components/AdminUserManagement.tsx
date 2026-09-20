'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Copy,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Power,
} from 'lucide-react';
import { User, Role } from '@/types';
import { listAllUsersAction, createUserAction, setUserActiveAction } from '@/lib/actions';

interface AdminUserManagementProps {
  currentUser: User;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  DEMONSTRATOR: 'Demonstrator',
  EXECUTIVE: 'Executive',
  INSTRUCTOR: 'Instructor',
  GUEST: 'Guest',
};

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('INSTRUCTOR');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ user: User; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllUsersAction();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const closeModal = () => {
    setModalOpen(false);
    setFullName('');
    setEmail('');
    setRole('INSTRUCTOR');
    setPhone('');
    setFormError(null);
    setCreatedResult(null);
    setCopied(false);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const res = await createUserAction({ fullName, email, role, phone: phone || undefined });
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.error);
      return;
    }
    setCreatedResult({ user: res.user, tempPassword: res.tempPassword });
    fetchUsers();
  };

  const handleCopyTempPassword = async () => {
    if (!createdResult) return;
    try {
      await navigator.clipboard.writeText(createdResult.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('Could not copy. Please copy the password manually before closing this dialog.');
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    if (!confirm(`${user.isActive ? 'Deactivate' : 'Reactivate'} ${user.fullName}?`)) return;
    await setUserActiveAction(user.id, !user.isActive);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Staff & Access Management</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Add staff accounts and assign roles. New accounts get a one-time temporary password to relay to the
              person directly -- they&apos;ll be asked to set their own password on first sign-in.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center space-x-2">
          <Users className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-200 text-sm">All Accounts ({users.length})</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500 text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100 truncate">{u.fullName}</span>
                    <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full uppercase shrink-0">
                      {ROLE_LABELS[u.role]}
                    </span>
                    {!u.isActive && (
                      <span className="text-[10px] font-medium bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full uppercase shrink-0">
                        Deactivated
                      </span>
                    )}
                    {u.mustChangePassword && (
                      <span className="text-[10px] font-medium bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full uppercase shrink-0">
                        Pending First Login
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {u.email}
                    {u.phone ? ` • ${u.phone}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(u)}
                  disabled={u.id === currentUser.id}
                  title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                  className={`shrink-0 flex items-center space-x-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    u.isActive
                      ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{u.isActive ? 'Deactivate' : 'Reactivate'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <button aria-label="Close" onClick={closeModal} className="absolute inset-0 cursor-default" />
          <div className="relative bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">
                {createdResult ? 'Account Created' : 'Add Staff Member'}
              </h3>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 text-lg font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {createdResult ? (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {createdResult.user.fullName}&apos;s account was created as {ROLE_LABELS[createdResult.user.role]}.
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    One-time temporary password -- share this with them directly. It won&apos;t be shown again.
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 font-mono tracking-wider">
                      {createdResult.tempPassword}
                    </code>
                    <button
                      onClick={handleCopyTempPassword}
                      className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer ${
                        copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="INSTRUCTOR">Instructor</option>
                    <option value="DEMONSTRATOR">Demonstrator</option>
                    <option value="EXECUTIVE">Executive</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone (optional)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="071 234 5678"
                    className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
