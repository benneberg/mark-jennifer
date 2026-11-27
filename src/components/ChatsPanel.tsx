import { useState } from 'react';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import type { Chat } from '../types';
import { formatDateTime } from '../utils/dates';
import { ConfirmModal } from './ConfirmModal';

interface ChatsPanelProps {
  chats: Chat[];
  activeChatId: string | null;
  disabled?: boolean;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatsPanel({
  chats,
  activeChatId,
  disabled,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatsPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);

  return (
    <div className="space-y-4 pb-8">
      <button
        type="button"
        disabled={disabled}
        onClick={onNewChat}
        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)] disabled:opacity-50 transition-all"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span>New chat</span>
      </button>

      {chats.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-6">
          No saved conversations yet.
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 p-3 rounded-[20px] border transition-all ${
                  isActive
                    ? 'glass-surface border-[var(--border-strong)] shadow-[var(--shadow)]'
                    : 'bg-[var(--surface-muted)] border-[var(--border)] hover:border-[var(--border-strong)]'
                }`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectChat(chat.id)}
                  className="flex-1 min-w-0 text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span
                        className="w-2 h-2 rounded-full bg-[var(--lime)] border border-[#181817] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm font-medium text-[var(--text)] truncate">
                      {chat.title || 'New marketing session'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono-tabular text-[var(--text-faint)]">
                    {formatDateTime(chat.updatedAt)}
                  </div>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPendingDelete(chat)}
                  aria-label={`Delete chat ${chat.title}`}
                  title="Delete chat"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--surface)] disabled:opacity-40 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete this conversation?"
        description={`"${
          pendingDelete?.title || 'New marketing session'
        }" and all of its messages will be permanently removed from this browser. Saved library items are not affected.`}
        confirmLabel="Delete conversation"
        danger
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) onDeleteChat(target.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
