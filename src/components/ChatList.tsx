import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Copy } from 'lucide-react';
import { CHAT_DISPLAY_CAP } from '../constants';
import { humanizeAIError, AIError } from '../providers/errors';
import type { ChatMessage, LibraryItemType } from '../types';
import { formatTime } from '../utils/dates';
import { SafeMarkdown } from '../utils/markdown';
import { EyeEmblem } from './EyeEmblem';

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
  onContinue?: (msg: ChatMessage) => void;
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
  onContinue,
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
      className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 scroll-smooth"
    >
      <div className="max-w-[780px] mx-auto space-y-4">
        {loading && (
          <div className="space-y-4" aria-label="Loading conversation">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-16 rounded-[24px] glass-surface border border-[var(--border)] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && !streamingState.active && (
          <div className="py-8 sm:py-14 flex flex-col items-center text-center space-y-7">
            <div className="flex flex-col items-center space-y-3 max-w-md">
              <EyeEmblem size="lg" className="mb-1" />
              <h1 className="text-[28px] sm:text-[34px] font-light tracking-[-0.025em] text-[var(--text)] [text-wrap:balance]">
                Hi, I&apos;m Jennifer
              </h1>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Your Hedetangen marketing partner. Tell me what you need — social captions, booking
                campaigns, pricing scenarios, or visual briefs grounded in your Brand DNA.
              </p>

              {!isConfigured && (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)] transition-all active:scale-[0.97]"
                  >
                    Open Settings
                  </button>
                  <button
                    type="button"
                    onClick={onEnableDemoMode}
                    className="min-h-[44px] px-5 py-2 text-sm font-medium rounded-full glass-surface border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)] transition-all active:scale-[0.97]"
                  >
                    Try demo mode
                  </button>
                </div>
              )}
            </div>

            <div className="w-full max-w-2xl space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-faint)]">Try asking</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onSelectSuggestion(suggestion)}
                    className="min-h-[42px] px-4 py-2 text-[13px] font-medium rounded-full glass-surface border border-[var(--border)] text-[var(--text)] hover:bg-[var(--lime)] hover:text-[#181817] hover:border-transparent hover:-translate-y-0.5 transition-all"
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
              className="min-h-[40px] px-4 py-1.5 text-xs font-medium rounded-full glass-surface border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
            >
              Load {hiddenCount} older messages
            </button>
          </div>
        )}

        {visibleMessages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex flex-col items-end gap-1">
                <div className="user-msg-bubble max-w-[88%] sm:max-w-[76%] px-[17px] py-[13px] rounded-[24px] rounded-br-[6px] bg-[var(--user-bubble-bg)] text-[var(--user-bubble-text)] shadow-[var(--shadow)]">
                  <p className="text-[0.935rem] whitespace-pre-wrap break-words leading-relaxed dark:font-medium">
                    {msg.content}
                  </p>
                </div>
                <div className="px-2 text-[11px] font-medium text-[var(--text-faint)]">
                  <span>You</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-tabular">{formatTime(msg.timestamp)}</span>
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
              <div key={msg.id} className="flex flex-col items-start gap-1.5">
                <div
                  role="alert"
                  className="max-w-[92%] sm:max-w-[82%] p-4 rounded-[24px] rounded-bl-[6px] glass-surface border border-[var(--danger)] shadow-[var(--shadow)] space-y-3"
                >
                  <p className="text-sm text-[var(--text)] leading-relaxed">{humanized.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {humanized.actions.map((act, idx) => (
                      <button
                        key={act.label}
                        type="button"
                        onClick={() => onErrorAction(act.type, msg, act.altModelId)}
                        className={`min-h-[40px] px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                          idx === 0
                            ? 'bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817]'
                            : 'glass-surface border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-2 text-[11px] font-medium text-[var(--danger)]">
                  <span>Jennifer</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-tabular">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            );
          }

          return (
            <article key={msg.id} className="flex flex-col items-start gap-1.5">
              <div className="max-w-[92%] sm:max-w-[84%] px-[18px] py-[14px] rounded-[24px] rounded-bl-[6px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-2.5">
                {msg.handoffText && (
                  <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                    {msg.handoffText}
                  </p>
                )}

                <div className="text-[var(--text)]">
                  <SafeMarkdown content={msg.content} />
                  {msg.status === 'stopped' && (
                    <span className="inline-block mt-1 text-xs text-[var(--text-faint)]">
                      — stopped (saved)
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => handleCopyClick(msg.id, msg.content)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
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
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${
                        msg.savedToLibrary ? 'fill-[var(--tangerine)] text-[var(--tangerine)]' : ''
                      }`}
                    />
                    <span>{msg.savedToLibrary ? 'Saved to library' : 'Save to library'}</span>
                  </button>

                  {msg.status === 'stopped' && onContinue && isConfigured && !streamingState.active && (
                    <button
                      type="button"
                      onClick={() => onContinue(msg)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] transition-colors"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </div>

              <div className="px-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--text-faint)]">
                <span className="text-[var(--text-muted)]">Jennifer</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{formatTime(msg.timestamp)}</span>
                {msg.delegatedExperts && msg.delegatedExperts.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Reviewed with {msg.delegatedExperts.join(', ')}</span>
                  </>
                )}
              </div>

              {savePopoverId === msg.id && (
                <div className="mt-1 p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow-md)] space-y-3 w-full max-w-md">
                  <div className="text-xs font-semibold text-[var(--text)]">
                    Save to Content Library
                  </div>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3.5 py-2 text-sm rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={saveType}
                      onChange={(e) => setSaveType(e.target.value as LibraryItemType)}
                      aria-label="Content type"
                      className="px-3.5 py-2 text-sm rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
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
                      className="px-3.5 py-2 text-sm rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSavePopoverId(null)}
                      className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => submitSavePopover(msg)}
                      className="min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817]"
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
          <article
            className="flex flex-col items-start gap-1.5"
            aria-live="polite"
            aria-atomic="false"
          >
            {streamingState.handoffText && (
              <div className="max-w-[92%] sm:max-w-[84%] px-[18px] py-[13px] rounded-[24px] rounded-bl-[6px] glass-surface border border-[var(--border)] text-[13px] text-[var(--text-muted)] leading-relaxed shadow-[var(--shadow)]">
                {streamingState.handoffText}
              </div>
            )}

            {streamingState.status && !streamingState.buffer && (
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-[24px] rounded-bl-[6px] glass-surface border border-[var(--border)] shadow-[var(--shadow)]">
                <div className="flex items-center gap-1" aria-hidden="true">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {streamingState.status}
                </span>
              </div>
            )}

            {streamingState.buffer && (
              <div className="max-w-[92%] sm:max-w-[84%] px-[18px] py-[14px] rounded-[24px] rounded-bl-[6px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] text-[var(--text)] streaming-caret">
                <SafeMarkdown content={streamingState.buffer} />
              </div>
            )}

            <div className="px-2 text-[11px] font-medium text-[var(--text-faint)]">
              <span>Jennifer · …</span>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
