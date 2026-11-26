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
    const maxHeight = 128; // ~5 rows
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

  const canSend = isConfigured && Boolean(draft.trim());

  return (
    <div
      ref={containerRef}
      className="sticky bottom-0 z-20 px-3 sm:px-6 pt-2 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-[780px] mx-auto">
        {!isConfigured && (
          <div className="mb-2.5 px-4 py-2.5 rounded-[20px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>Add an API key in Settings to start, or try Demo Mode offline.</span>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onEnableDemoMode}
                className="min-h-[34px] px-3 py-1 rounded-full font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors whitespace-nowrap"
              >
                Try demo mode
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="min-h-[34px] px-3.5 py-1 rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] font-semibold transition-colors whitespace-nowrap"
              >
                Open Settings
              </button>
            </div>
          </div>
        )}

        {(refOpen || referencePhoto.trim()) && (
          <div className="mb-2 flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-surface border border-[var(--border)] shadow-[var(--shadow)]">
            <Camera className="w-4 h-4 text-[var(--tangerine)] shrink-0" />
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
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 min-h-[48px] flex items-end gap-1 pl-2 pr-2 py-1.5 rounded-[26px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] focus-within:border-[var(--text)] transition-colors">
            <button
              type="button"
              onClick={onOpenWizard}
              disabled={isStreaming}
              aria-label="Open Guided Campaign Builder"
              title="Guided Campaign Builder"
              className="w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 transition-colors shrink-0"
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
              className={`w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full transition-colors shrink-0 disabled:opacity-40 ${
                referencePhoto.trim()
                  ? 'bg-[var(--lime)] text-[#181817]'
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
                  ? 'Message Jennifer…'
                  : 'Configure an API key or Demo Mode above to begin…'
              }
              aria-label="Message Jennifer"
              className="flex-1 resize-none bg-transparent py-2 px-1.5 text-[14.5px] leading-snug text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none disabled:opacity-60 max-h-[128px]"
            />
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop generating"
              className="w-12 h-12 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full bg-[var(--tangerine)] text-[#181817] shadow-[var(--shadow)] hover:opacity-90 active:scale-95 transition-all shrink-0"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send"
              title="Send message"
              className={`w-12 h-12 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full transition-all shrink-0 ${
                canSend
                  ? 'bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)] hover:scale-[1.03] active:scale-95'
                  : 'glass-surface border border-[var(--border)] text-[var(--text-faint)] cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}
        </div>

        {isStreaming && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)] px-2">
            Jennifer is working — tap Stop to cancel.
          </p>
        )}
      </div>
    </div>
  );
}
