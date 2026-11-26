import { X } from 'lucide-react';
import type { ToastItem } from '../types';

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed z-50 bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-88 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.slice(0, 3).map((toast) => {
        const accentClass =
          toast.variant === 'danger'
            ? 'border-[var(--tangerine)]'
            : toast.variant === 'success'
              ? 'border-[var(--lime)]'
              : 'border-transparent';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-[#181817] text-[#F4EFE4] dark:bg-[var(--sand)] dark:text-[#181817] border ${accentClass} shadow-[var(--shadow-md)] text-xs font-semibold`}
          >
            <span className="leading-snug pl-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full opacity-70 hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
