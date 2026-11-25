import { HISTORY_MAX_MESSAGES, HISTORY_MAX_TOKENS_APPROX } from '../constants';
import type { ChatCompletionMessage, ChatMessage, Expert } from '../types';

export function resolveExpert(nameOrId: string, experts: Expert[]): Expert | null {
  const target = nameOrId.trim().toLowerCase();
  if (!target) return null;
  const byName = experts.find((e) => e.enabled && e.name.toLowerCase() === target);
  if (byName) return byName;
  const byId = experts.find((e) => e.enabled && e.id.toLowerCase() === target);
  return byId ?? null;
}

export function trimChatHistory(messages: ChatMessage[]): ChatCompletionMessage[] {
  // Only include user and jennifer complete/stopped messages; exclude expert internals & error cards
  const eligible = messages.filter(
    (m) =>
      (m.role === 'user' || m.role === 'jennifer') &&
      m.status !== 'error' &&
      m.content.trim().length > 0
  );

  const recent = eligible.slice(-HISTORY_MAX_MESSAGES);
  const result: ChatCompletionMessage[] = [];
  let approxTokens = 0;

  // Walk backwards so most recent messages are always kept first
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const msgTokens = Math.ceil(m.content.length / 4) + 8;
    if (approxTokens + msgTokens > HISTORY_MAX_TOKENS_APPROX && result.length > 0) {
      break;
    }
    approxTokens += msgTokens;
    result.unshift({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    });
  }

  return result;
}
