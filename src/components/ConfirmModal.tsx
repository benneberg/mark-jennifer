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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
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
        className="w-full max-w-md rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-drawer)] p-5 text-[var(--text)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-modal-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="min-h-[40px] min-w-[40px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>

        {children && <div className="mt-4">{children}</div>}

        {requireTypedText && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Type <span className="font-mono-tabular font-semibold text-[var(--text)]">{requireTypedText}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTypedText}
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
              danger
                ? 'bg-[var(--danger)] text-white hover:opacity-90'
                : 'bg-[var(--accent)] text-white hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
