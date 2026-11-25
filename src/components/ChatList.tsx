import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Copy } from 'lucide-react';
import { CHAT_DISPLAY_CAP } from '../constants';
import { humanizeAIError, AIError } from '../providers/errors';
import type { ChatMessage, LibraryItemType } from '../types';
import { formatTime } from '../utils/dates';
import { SafeMarkdown } from '../utils/markdown';

const STARTER_SUGGESTIONS = [
  'Draft three Instagram captions for a winter sauna campaign.',
  'Plan a spring campaign to fill summer bookings.',
  'What should I post this week?',
];

interface ChatListProps {
  messages: ChatMessage[];
  loading: boolean;
  isConfigured: boolean;
  streamingState: {
    active: boolean;
    status: string | null;
    handoffText: string | null;
    expertLabel: string | null;
    buffer: string;
  };
  altModelId?: string;
  onSelectSuggestion: (text: string) => void;
  onOpenSettings: () => void;
  onEnableDemoMode: () => void;
  onSaveToLibrary: (
    msg: ChatMessage,
    payload: { title: string; type: LibraryItemType; tags: string[] }
  ) => Promise<void>;
  onErrorAction: (
    action: 'open_settings' | 'retry' | 'try_alt_model' | 'new_chat',
    msg: ChatMessage,
    altModelId?: string
  ) => void;
  onCopy: (text: string) => void;
}

export function ChatList({
  messages,
  loading,
  isConfigured,
  streamingState,
  altModelId,
  onSelectSuggestion,
  onOpenSettings,
  onEnableDemoMode,
  onSaveToLibrary,
  onErrorAction,
  onCopy,
}: ChatListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showAllOlder, setShowAllOlder] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savePopoverId, setSavePopoverId] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveType, setSaveType] = useState<LibraryItemType>('copy');
  const [saveTags, setSaveTags] = useState('');

  // Auto-scroll only when user is already near the bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120 || streamingState.active) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, streamingState.buffer, streamingState.status, streamingState.active]);

  const handleCopyClick = (id: string, text: string) => {
    onCopy(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1600);
  };

  const openSavePopover = (msg: ChatMessage) => {
    const firstLine = msg.content.split('\n').find((l) => l.trim().length > 0) ?? 'Saved output';
    const cleanTitle = firstLine.replace(/^[#*\-\s]+/, '').slice(0, 80);
    setSaveTitle(cleanTitle || 'Saved output');
    setSaveType('copy');
    setSaveTags('hedetangen');
    setSavePopoverId(msg.id);
  };

  const submitSavePopover = async (msg: ChatMessage) => {
    const tags = saveTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    await onSaveToLibrary(msg, {
      title: saveTitle.trim() || 'Saved output',
      type: saveType,
      tags,
    });
    setSavePopoverId(null);
  };

  const visibleMessages =
    !showAllOlder && messages.length > CHAT_DISPLAY_CAP
      ? messages.slice(-CHAT_DISPLAY_CAP)
      : messages;
  const hiddenCount = messages.length - visibleMessages.length;

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-3 sm:px-6 py-5"
    >
      <div className="max-w-[760px] mx-auto space-y-5">
        {loading && (
          <div className="space-y-4" aria-label="Loading conversation">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-16 rounded-xl bg-[var(--surface-muted)] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && !streamingState.active && (
          <div className="py-6 sm:py-10 space-y-6">
            <div className="p-5 sm:p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-[var(--text)] [text-wrap:balance]">
                  Hej! I&apos;m Jennifer, your marketing partner for Hedetangen.
                </h1>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xl">
                  Tell me what you need — social captions, booking campaigns, pricing scenarios, or
                  atmospheric visual briefs. Every output stays grounded in your Brand DNA and
                  honesty rule.
                </p>
              </div>

              {!isConfigured && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                  >
                    Open Settings
                  </button>
                  <button
                    type="button"
                    onClick={onEnableDemoMode}
                    className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    Try demo mode
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Try asking</p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onSelectSuggestion(suggestion)}
                    className="min-h-[44px] text-left px-3.5 py-2.5 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllOlder(true)}
              className="min-h-[40px] px-4 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Load {hiddenCount} older messages
            </button>
          </div>
        )}

        {visibleMessages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="w-full sm:w-auto sm:max-w-[82%] p-3.5 sm:px-4 sm:py-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
                  <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-muted)] mb-1">
                    <span className="font-medium text-[var(--text)]">You</span>
                    <span className="font-mono-tabular">{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-[0.95rem] text-[var(--text)] whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          }

          if (msg.status === 'error' && msg.errorData) {
            const errObj = new AIError({
              code: msg.errorData.code,
              message: msg.content,
              provider: msg.errorData.provider,
              status: msg.errorData.status,
              retryAfterMs: msg.errorData.retryAfterMs,
            });
            const humanized = humanizeAIError(errObj, {
              modelId: msg.errorData.modelId,
              altModelId,
            });
            return (
              <div
                key={msg.id}
                role="alert"
                className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--danger)] space-y-3"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--danger)]">Jennifer</span>
                  <span className="font-mono-tabular">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed">{humanized.message}</p>
                <div className="flex flex-wrap gap-2">
                  {humanized.actions.map((act) => (
                    <button
                      key={act.label}
                      type="button"
                      onClick={() => onErrorAction(act.type, msg, act.altModelId)}
                      className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)] transition-colors"
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <article key={msg.id} className="space-y-2.5 py-1">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text)]">Jennifer</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{formatTime(msg.timestamp)}</span>
                {msg.delegatedExperts && msg.delegatedExperts.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Reviewed with {msg.delegatedExperts.join(', ')}</span>
                  </>
                )}
              </div>

              {msg.handoffText && (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {msg.handoffText}
                </p>
              )}

              <div className="text-[var(--text)]">
                <SafeMarkdown content={msg.content} />
                {msg.status === 'stopped' && (
                  <span className="inline-block mt-1 text-xs text-[var(--text-faint)]">
                    — stopped
                  </span>
                )}
              </div>

              <div className="relative flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyClick(msg.id, msg.content)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    savePopoverId === msg.id ? setSavePopoverId(null) : openSavePopover(msg)
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      msg.savedToLibrary ? 'fill-[var(--accent)] text-[var(--accent)]' : ''
                    }`}
                  />
                  <span>{msg.savedToLibrary ? 'Saved to library' : 'Save to library'}</span>
                </button>
              </div>

              {savePopoverId === msg.id && (
                <div className="mt-2 p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3 max-w-md">
                  <div className="text-xs font-semibold text-[var(--text)]">Save to Content Library</div>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={saveType}
                      onChange={(e) => setSaveType(e.target.value as LibraryItemType)}
                      aria-label="Content type"
                      className="px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                    >
                      <option value="copy">Copy</option>
                      <option value="campaign">Campaign</option>
                      <option value="research">Research</option>
                      <option value="visual-brief">Visual brief</option>
                      <option value="note">Note</option>
                    </select>
                    <input
                      type="text"
                      value={saveTags}
                      onChange={(e) => setSaveTags(e.target.value)}
                      placeholder="Tags (comma-separated)"
                      className="px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSavePopoverId(null)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => submitSavePopover(msg)}
                      className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {streamingState.active && (
          <article className="space-y-2.5 py-1" aria-live="polite" aria-atomic="false">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">Jennifer</span>
            </div>

            {streamingState.handoffText && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {streamingState.handoffText}
              </p>
            )}

            {streamingState.status && !streamingState.buffer && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] working-dot" />
                <span>{streamingState.status}</span>
              </div>
            )}

            {streamingState.buffer && (
              <div className="text-[var(--text)] streaming-caret">
                <SafeMarkdown content={streamingState.buffer} />
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
