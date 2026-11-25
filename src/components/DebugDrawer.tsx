import { X } from 'lucide-react';
import type { DebugEntry } from '../types';
import { formatTime } from '../utils/dates';

interface DebugDrawerProps {
  open: boolean;
  entries: DebugEntry[];
  onClose: () => void;
  onClear: () => void;
}

export function DebugDrawer({ open, entries, onClose, onClear }: DebugDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-[440px] z-40 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-[var(--shadow-drawer)] p-4 text-xs text-[var(--text)] max-h-[55vh] flex flex-col">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
        <span className="font-semibold">Diagnostics (?debug=1)</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diagnostics"
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto space-y-2">
        {entries.length === 0 ? (
          <p className="text-[var(--text-muted)] py-3">No orchestration events recorded yet.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] space-y-1"
            >
              <div className="flex items-center justify-between gap-2 font-mono-tabular text-[11px] text-[var(--text-muted)]">
                <span>{entry.type}</span>
                <span>{formatTime(entry.timestamp)}</span>
              </div>
              <p className="text-[var(--text)]">{entry.summary}</p>
              {(entry.callCount !== undefined || entry.durationMs !== undefined) && (
                <p className="font-mono-tabular text-[11px] text-[var(--text-faint)]">
                  {entry.callCount !== undefined ? `Calls: ${entry.callCount}` : ''}
                  {entry.callCount !== undefined && entry.durationMs !== undefined ? ' · ' : ''}
                  {entry.durationMs !== undefined ? `Duration: ${entry.durationMs}ms` : ''}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
