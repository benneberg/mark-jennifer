import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  requireTypedText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  requireTypedText,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped('');
      return;
    }
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;

      // Keep keyboard focus inside the dialog (aria-modal alone does not do it).
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      prevFocus?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = !requireTypedText || typed.trim() === requireTypedText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(24,24,23,0.52)] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md rounded-[28px] bg-[var(--bg)] border border-[var(--border)] shadow-[var(--shadow-md)] p-5 sm:p-6 text-[var(--text)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-modal-title" className="text-lg font-light tracking-[-0.015em]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="min-h-[38px] min-w-[38px] -mr-1 -mt-1 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>

        {children && <div className="mt-4">{children}</div>}

        {requireTypedText && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
              Type <span className="font-mono-tabular text-[var(--text)]">{requireTypedText}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTypedText}
              className="w-full px-3.5 py-2.5 text-sm rounded-[16px] glass-surface border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[42px] px-4 py-2 text-sm font-medium rounded-full border border-[var(--border)] glass-surface text-[var(--text)] hover:border-[var(--border-strong)] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`min-h-[42px] px-5 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
              danger
                ? 'bg-[var(--tangerine)] text-[#181817] hover:opacity-90'
                : 'bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
