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
        const borderClass =
          toast.variant === 'danger'
            ? 'border-[var(--danger)]'
            : toast.variant === 'success'
              ? 'border-[var(--success)]'
              : 'border-[var(--border-strong)]';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--surface)] border ${borderClass} shadow-[var(--shadow-drawer)] text-sm text-[var(--text)]`}
          >
            <span className="leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
