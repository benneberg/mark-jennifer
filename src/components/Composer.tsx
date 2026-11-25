import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, Plus, Square, X } from 'lucide-react';

interface ComposerProps {
  draft: string;
  onDraftChange: (next: string) => void;
  referencePhoto: string;
  onReferencePhotoChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  onOpenWizard: () => void;
  onOpenSettings: () => void;
  onEnableDemoMode: () => void;
  isStreaming: boolean;
  isConfigured: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  draft,
  onDraftChange,
  referencePhoto,
  onReferencePhotoChange,
  onSend,
  onStop,
  onOpenWizard,
  onOpenSettings,
  onEnableDemoMode,
  isStreaming,
  isConfigured,
  inputRef,
}: ComposerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [refOpen, setRefOpen] = useState(Boolean(referencePhoto));

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 132; // ~5 rows
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [draft, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && isConfigured && draft.trim()) {
        onSend();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="sticky bottom-0 z-20 bg-[var(--bg)] border-t border-[var(--border)] px-3 sm:px-6 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-[760px] mx-auto">
        {!isConfigured && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>Add an API key in Settings to start, or try Demo Mode offline.</span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onEnableDemoMode}
                className="font-medium text-[var(--accent-text)] hover:underline whitespace-nowrap"
              >
                Try demo mode
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 whitespace-nowrap"
              >
                Open Settings
              </button>
            </div>
          </div>
        )}

        {(refOpen || referencePhoto.trim()) && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            <Camera className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <input
              type="text"
              value={referencePhoto}
              maxLength={400}
              disabled={isStreaming}
              onChange={(e) => onReferencePhotoChange(e.target.value)}
              placeholder="Describe real reference photo (optional — blank = atmosphere-only visuals)"
              aria-label="Reference photo description"
              className="flex-1 min-w-0 bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onReferencePhotoChange('');
                setRefOpen(false);
              }}
              aria-label="Clear reference photo description"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-1.5 p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
          <button
            type="button"
            onClick={onOpenWizard}
            disabled={isStreaming}
            aria-label="Open Guided Campaign Builder"
            title="Guided Campaign Builder"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 transition-colors shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setRefOpen((o) => !o)}
            disabled={isStreaming}
            aria-label="Add reference photo description"
            aria-pressed={refOpen || Boolean(referencePhoto.trim())}
            title="Reference photo description (for Visual Director)"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors shrink-0 disabled:opacity-40 ${
              referencePhoto.trim()
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]'
            }`}
          >
            <Camera className="w-4 h-4" />
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={isStreaming || !isConfigured}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConfigured
                ? 'Ask Jennifer anything about marketing, copy, campaigns, or pricing…'
                : 'Configure an API key or Demo Mode above to begin…'
            }
            aria-label="Message Jennifer"
            className="flex-1 resize-none bg-transparent py-2.5 px-1 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none disabled:opacity-60 max-h-[132px]"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop generating"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[var(--danger)] text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!isConfigured || !draft.trim()}
              aria-label="Send"
              title="Send message"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity shrink-0"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </div>

        {isStreaming && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)] px-1">
            Jennifer is working — tap Stop to cancel.
          </p>
        )}
      </div>
    </div>
  );
}
