import type { AIErrorCode, ProviderId } from '../types';

export class AIError extends Error {
  code: AIErrorCode;
  provider: ProviderId;
  status?: number;
  retryAfterMs?: number;
  raw?: unknown;

  constructor({
    code,
    message,
    provider,
    status,
    retryAfterMs,
    raw,
  }: {
    code: AIErrorCode;
    message: string;
    provider: ProviderId;
    status?: number;
    retryAfterMs?: number;
    raw?: unknown;
  }) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.raw = raw;
  }
}

export interface HumanizedError {
  message: string;
  actions: Array<{
    type: 'open_settings' | 'retry' | 'try_alt_model' | 'new_chat';
    label: string;
    altModelId?: string;
  }>;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  groq: 'Groq',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  mock: 'Demo Mode',
};

export function humanizeAIError(
  error: AIError,
  context: { modelId?: string; altModelId?: string } = {}
): HumanizedError {
  const providerName = PROVIDER_LABELS[error.provider] ?? error.provider;

  switch (error.code) {
    case 'AUTH_INVALID':
      return {
        message: `The API key was rejected by ${providerName}. It may have been revoked or pasted incorrectly.`,
        actions: [{ type: 'open_settings', label: 'Open Settings' }],
      };

    case 'RATE_LIMIT': {
      const waitSec = error.retryAfterMs ? Math.max(1, Math.round(error.retryAfterMs / 1000)) : null;
      const waitHint = waitSec ? ` (retry in ~${waitSec}s)` : '';
      const actions: HumanizedError['actions'] = [];
      if (context.altModelId && context.altModelId !== context.modelId) {
        actions.push({
          type: 'try_alt_model',
          label: `Try ${context.altModelId}`,
          altModelId: context.altModelId,
        });
      }
      actions.push({ type: 'retry', label: 'Retry' });
      return {
        message: `The selected model is rate-limited right now${waitHint}. I can try a different model or wait a moment — what do you prefer?`,
        actions,
      };
    }

    case 'QUOTA_EXCEEDED':
      return {
        message: `${providerName} reports your free quota is used up for today or this minute.`,
        actions: [
          { type: 'open_settings', label: 'Switch provider' },
          { type: 'retry', label: 'Retry' },
        ],
      };

    case 'MODEL_NOT_FOUND':
      return {
        message: `The model '${context.modelId ?? 'selected'}' isn't available anymore. It may have been retired.`,
        actions: [{ type: 'open_settings', label: 'Refresh model list' }],
      };

    case 'MODEL_UNSUPPORTED':
      return {
        message: `That model doesn't support chat completions. Please pick another chat model in Settings.`,
        actions: [{ type: 'open_settings', label: 'Pick another model' }],
      };

    case 'CONTEXT_TOO_LONG':
      return {
        message: `The conversation is longer than this model can hold. Start a new chat so we have a clean slate.`,
        actions: [{ type: 'new_chat', label: 'New chat' }],
      };

    case 'NETWORK':
      return {
        message: `I couldn't reach ${providerName}. Check your internet connection and try again.`,
        actions: [{ type: 'retry', label: 'Retry' }],
      };

    case 'TIMEOUT':
      return {
        message: `The model took too long to respond. Want me to try again?`,
        actions: [{ type: 'retry', label: 'Retry' }],
      };

    case 'PROVIDER_ERROR':
      return {
        message: `${providerName} returned a temporary server error${error.status ? ` (${error.status})` : ''}. This is on their side.`,
        actions: [{ type: 'retry', label: 'Retry' }],
      };

    default:
      return {
        message: error.message || `Something went wrong communicating with ${providerName}.`,
        actions: [
          { type: 'retry', label: 'Retry' },
          { type: 'open_settings', label: 'Open Settings' },
        ],
      };
  }
}

export function mapHttpError(
  provider: ProviderId,
  status: number,
  bodyText: string,
  retryAfterHeader?: string | null
): AIError {
  const lower = bodyText.toLowerCase();
  let retryAfterMs: number | undefined;
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (Number.isFinite(secs)) retryAfterMs = secs * 1000;
  }

  let parsedMessage = '';
  try {
    const json = JSON.parse(bodyText);
    parsedMessage = json?.error?.message || json?.message || '';
  } catch {
    parsedMessage = bodyText.slice(0, 240);
  }

  if (retryAfterMs === undefined && parsedMessage) {
    const secMatch = parsedMessage.match(/try again in\s+(\d+(?:\.\d+)?)\s*s\b/i);
    if (secMatch) {
      retryAfterMs = Math.ceil(Number(secMatch[1]) * 1000);
    } else {
      const msMatch = parsedMessage.match(/try again in\s+(\d+(?:\.\d+)?)\s*ms\b/i);
      if (msMatch) {
        retryAfterMs = Math.ceil(Number(msMatch[1]));
      }
    }
  }

  if (status === 401 || status === 403) {
    return new AIError({
      code: 'AUTH_INVALID',
      message: parsedMessage || 'Authentication failed',
      provider,
      status,
    });
  }
  if (status === 402 || (status === 429 && lower.includes('quota'))) {
    return new AIError({
      code: 'QUOTA_EXCEEDED',
      message: parsedMessage || 'Quota exceeded',
      provider,
      status,
      retryAfterMs,
    });
  }
  if (status === 429) {
    return new AIError({
      code: 'RATE_LIMIT',
      message: parsedMessage || 'Rate limit reached',
      provider,
      status,
      retryAfterMs,
    });
  }
  if (status === 404) {
    return new AIError({
      code: 'MODEL_NOT_FOUND',
      message: parsedMessage || 'Model not found',
      provider,
      status,
    });
  }
  if (status === 400) {
    if (lower.includes('context') || lower.includes('token') || lower.includes('too long')) {
      return new AIError({
        code: 'CONTEXT_TOO_LONG',
        message: parsedMessage || 'Context length exceeded',
        provider,
        status,
      });
    }
    return new AIError({
      code: 'MODEL_UNSUPPORTED',
      message: parsedMessage || 'Model or request unsupported',
      provider,
      status,
    });
  }
  if (status >= 500) {
    return new AIError({
      code: 'PROVIDER_ERROR',
      message: parsedMessage || 'Provider server error',
      provider,
      status,
    });
  }

  return new AIError({
    code: 'UNKNOWN',
    message: parsedMessage || `HTTP ${status}`,
    provider,
    status,
  });
}
