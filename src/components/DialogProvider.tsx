'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface NotifyOptions {
  title?: string;
  message: string;
  danger?: boolean;
}

interface DialogContextValue {
  // Resolves true/false instead of blocking the thread like window.confirm.
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  // Single-button replacement for window.alert.
  notify: (opts: NotifyOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type PendingDialog =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'notify'; opts: NotifyOptions; resolve: () => void };

// App-wide replacement for window.confirm/window.alert: those render as
// native OS chrome (see e.g. Safari's blocking "Deactivate Test?" sheet)
// which looks out of place next to the rest of this dark, custom UI. Mount
// once near the app root; any descendant calls useDialog() to pop a
// dark-themed modal instead.
export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  // Portals need document.body, which doesn't exist during SSR -- only
  // render the portal once mounted client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise((resolve) => setPending({ kind: 'confirm', opts: normalized, resolve }));
  }, []);

  const notify = useCallback((opts: NotifyOptions | string): Promise<void> => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise((resolve) => setPending({ kind: 'notify', opts: normalized, resolve: () => resolve() }));
  }, []);

  const close = (result: boolean) => {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(result);
    else pending.resolve();
    setPending(null);
  };

  const dialog = pending ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4"
      onClick={() => close(false)}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start space-x-3">
          <div
            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
              pending.opts.danger ? 'bg-rose-500/15 text-rose-400' : 'bg-indigo-500/15 text-indigo-400'
            }`}
          >
            {pending.opts.danger ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          </div>
          <div className="min-w-0 pt-0.5">
            {pending.opts.title && <h3 className="text-sm font-semibold text-white mb-1">{pending.opts.title}</h3>}
            <p className="text-sm text-slate-300 leading-relaxed">{pending.opts.message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          {pending.kind === 'confirm' && (
            <button
              onClick={() => close(false)}
              className="text-sm font-medium text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {pending.opts.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => close(true)}
            autoFocus
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer text-white ${
              pending.opts.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {pending.kind === 'confirm' ? pending.opts.confirmLabel || 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {/* Portalled straight to <body> so no ancestor's stacking context,
          transform, or filter can ever break this modal's fixed positioning
          or clip its width -- both symptoms observed when it was rendered
          inline in the component tree. */}
      {mounted && dialog && createPortal(dialog, document.body)}
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}
