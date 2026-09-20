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
  Trash2,
  X,
} from 'lucide-react';
import { User, Role } from '@/types';
import { listAllUsersAction, createUserAction, setUserActiveAction, deleteUserAction } from '@/lib/actions';
import { useDialog } from './DialogProvider';

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

// The only INSTRUCTOR-role job title distinction that exists -- plain
// instructors carry no jobTitle at all and just display as "Instructor"
// (see ROLE_LABELS). A Technical Assistant has identical permissions; this
// only changes how they're labelled.
const TECHNICAL_ASSISTANT_TITLE = 'Technical Assistant';

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const { confirm, notify } = useDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('INSTRUCTOR');
  const [isTechnicalAssistant, setIsTechnicalAssistant] = useState(false);
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

  const closePanel = () => {
    setPanelOpen(false);
    setFullName('');
    setUsername('');
    setEmail('');
    setRole('INSTRUCTOR');
    setIsTechnicalAssistant(false);
    setPhone('');
    setFormError(null);
    setCreatedResult(null);
    setCopied(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    let res;
    try {
      res = await createUserAction({
        fullName,
        username,
        email: email || undefined,
        role,
        jobTitle: role === 'INSTRUCTOR' && isTechnicalAssistant ? TECHNICAL_ASSISTANT_TITLE : undefined,
        phone: phone || undefined,
      });
    } catch (err) {
      console.error('Error creating user:', err);
      setSubmitting(false);
      setFormError('Something went wrong creating this account. Please try again.');
      return;
    }
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
      await notify('Could not copy. Please copy the password manually before closing this panel.');
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser.id) {
      await notify('You cannot deactivate your own account.');
      return;
    }
    const proceed = await confirm({
      title: user.isActive ? 'Deactivate account' : 'Reactivate account',
      message: `${user.isActive ? 'Deactivate' : 'Reactivate'} ${user.fullName}?`,
      confirmLabel: user.isActive ? 'Deactivate' : 'Reactivate',
      danger: user.isActive,
    });
    if (!proceed) return;
    await setUserActiveAction(user.id, !user.isActive);
    fetchUsers();
  };

  const handleDelete = async (user: User) => {
    const proceed = await confirm({
      title: 'Permanently delete account',
      message: `Permanently delete ${user.fullName} (@${user.username})? This cannot be undone. Only accounts with no schedule or audit history can be deleted -- if this one has any, it will be refused.`,
      confirmLabel: 'Delete Permanently',
      danger: true,
    });
    if (!proceed) return;

    const res = await deleteUserAction(user.id);
    if (!res.success) {
      await notify({ title: 'Could not delete', message: res.error, danger: true });
      return;
    }
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
              Add staff accounts and assign roles. New accounts get a temporary password (
              <code className="text-slate-300">FirstName@123</code>) to relay to the person directly -- they&apos;ll
              be asked to set their own password, and add their email and phone, on first sign-in.
            </p>
          </div>
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Staff Member: inline panel, not a popup -- stays on the page like the rest of the console */}
      {panelOpen && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {createdResult ? 'Account Created' : 'Add Staff Member'}
            </h3>
            <button onClick={closePanel} className="text-slate-500 hover:text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            {createdResult ? (
              <div className="space-y-4 max-w-md">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {createdResult.user.fullName}&apos;s account was created as{' '}
                    {createdResult.user.jobTitle || ROLE_LABELS[createdResult.user.role]} with username{' '}
                    <strong>{createdResult.user.username}</strong>.
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
                  onClick={closePanel}
                  className="text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4 max-w-md">
                {formError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                    <input
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. jane.instructor"
                      className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Email (optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-sm bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                  {role === 'INSTRUCTOR' && (
                    <div className="flex items-end pb-2.5">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isTechnicalAssistant}
                          onChange={(e) => setIsTechnicalAssistant(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 cursor-pointer"
                        />
                        <span>Technical Assistant (instead of Instructor)</span>
                      </label>
                    </div>
                  )}
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
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {submitting ? 'Creating...' : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="text-sm font-medium text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
              <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-100 truncate max-w-full">{u.fullName}</span>
                    <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full uppercase shrink-0">
                      {u.jobTitle || ROLE_LABELS[u.role]}
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
                    @{u.username}
                    {u.email ? ` • ${u.email}` : ''}
                    {u.phone ? ` • ${u.phone}` : ''}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(u)}
                    disabled={u.id === currentUser.id}
                    title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                    className={`flex items-center space-x-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      u.isActive
                        ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{u.isActive ? 'Deactivate' : 'Reactivate'}</span>
                  </button>
                  {!u.isActive && (
                    <button
                      onClick={() => handleDelete(u)}
                      title="Permanently delete account"
                      className="flex items-center space-x-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
