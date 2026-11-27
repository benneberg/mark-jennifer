import { REQUEST_TIMEOUT_MS, STREAM_CHUNK_TIMEOUT_MS } from '../constants';
import type { ChatCompletionMessage, ChatResult, ModelInfo, ProviderId } from '../types';
import { AIError, mapHttpError } from './errors';

export type ChatStage = 'planner' | 'expert' | 'synthesis' | 'direct';

export interface ChatRequestOptions {
  model: string;
  /**
   * Explicit orchestration stage. Providers that simulate responses (Demo Mode)
   * use this instead of string-matching prompt internals, so renaming a prompt
   * tag can no longer silently break the offline path.
   */
  stage?: ChatStage;
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  streamInternal?: boolean;
  signal?: AbortSignal;
  onToken?: (delta: string) => void;
  onRetryWait?: (waitMs: number, attempt: number) => void;
}

export interface AIProvider {
  readonly id: ProviderId;
  validateKey(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  chat(options: ChatRequestOptions): Promise<ChatResult>;
}

export async function fetchWithTimeout(
  provider: ProviderId,
  url: string,
  init: RequestInit,
  externalSignal?: AbortSignal
): Promise<Response> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => timeoutController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      globalThis.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, { ...init, signal: timeoutController.signal });
    return res;
  } catch (err) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (timedOut || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new AIError({
        code: 'TIMEOUT',
        message: 'Request timed out',
        provider,
        raw: err,
      });
    }
    throw new AIError({
      code: 'NETWORK',
      message: err instanceof Error ? err.message : 'Network error',
      provider,
      raw: err,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

async function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isTransientStatus(status?: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 529;
}

/**
 * Provider error bodies frequently carry a *string* code (e.g.
 * "rate_limit_exceeded"), not an HTTP status. Mapping the known ones keeps the
 * retry/UX taxonomy correct instead of degrading everything to PROVIDER_ERROR.
 */
const ERROR_CODE_TO_STATUS: Record<string, number> = {
  invalid_api_key: 401,
  invalid_authentication: 401,
  authentication_error: 401,
  insufficient_quota: 402,
  billing_hard_limit_reached: 402,
  rate_limit_exceeded: 429,
  rate_limit_error: 429,
  tokens: 400,
  context_length_exceeded: 400,
  model_not_found: 404,
  invalid_request_error: 400,
  server_error: 500,
};

function statusFromErrorCode(code: unknown): number {
  if (typeof code === 'number' && Number.isFinite(code)) return code;
  if (typeof code === 'string') {
    const mapped = ERROR_CODE_TO_STATUS[code.trim().toLowerCase()];
    if (mapped !== undefined) return mapped;
  }
  return 500;
}

/**
 * OpenAI reasoning families (o1/o3/o4/gpt-5) reject a custom temperature and
 * require `max_completion_tokens`; sending classic chat params makes the model
 * fail with a hard 400 even though the app lists it as available.
 */
const REASONING_MODEL_PATTERN = /(^|\/)(o[1-9]|gpt-5)(\b|-)/i;

function usesReasoningParams(provider: ProviderId, model: string): boolean {
  if (provider !== 'openai' && provider !== 'openrouter') return false;
  return REASONING_MODEL_PATTERN.test(model.trim());
}

function buildChatRequestBody(
  provider: ProviderId,
  options: ChatRequestOptions,
  stream: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream,
  };
  if (usesReasoningParams(provider, options.model)) {
    if (options.maxTokens !== undefined) {
      body.max_completion_tokens = options.maxTokens;
    }
    return body;
  }
  body.temperature = options.temperature ?? 0.7;
  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
  }
  return body;
}

export async function runOpenAICompatibleChat(
  provider: ProviderId,
  baseUrl: string,
  headers: Record<string, string>,
  options: ChatRequestOptions
): Promise<ChatResult> {
  const stream = Boolean(options.onToken || options.streamInternal);
  const maxRetries = 3;
  let res!: Response;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fetchWithTimeout(
      provider,
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(buildChatRequestBody(provider, options, stream)),
      },
      options.signal
    );

    if (res.ok) break;

    const text = await res.text().catch(() => '');
    const mapped = mapHttpError(provider, res.status, text, res.headers.get('retry-after'));

    const canRetryRateLimit = mapped.code === 'RATE_LIMIT' && attempt < maxRetries;
    const canRetryTransient =
      mapped.code === 'PROVIDER_ERROR' && isTransientStatus(mapped.status) && attempt < maxRetries;

    if (canRetryRateLimit || canRetryTransient) {
      const fallbackDelay = mapped.code === 'RATE_LIMIT' ? (attempt + 1) * 4000 : (attempt + 1) * 1500;
      // Honour Retry-After, but never park the user for longer than a minute.
      const waitMs = Math.min(
        Math.max(1200, (mapped.retryAfterMs ?? fallbackDelay) + 400),
        60000
      );
      options.onRetryWait?.(waitMs, attempt + 1);
      await waitWithAbort(waitMs, options.signal);
      continue;
    }

    throw mapped;
  }

  if (!stream || !res.body) {
    let data: {
      error?: { message?: string; code?: number | string };
      choices?: Array<{
        message?: { content?: string; reasoning?: string; reasoning_content?: string };
        finish_reason?: string;
      }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    try {
      data = await res.json();
    } catch (err) {
      throw new AIError({
        code: 'PARSE_ERROR',
        message: 'Invalid JSON response from provider',
        provider,
        raw: err,
      });
    }
    if (data.error) {
      throw mapHttpError(
        provider,
        statusFromErrorCode(data.error.code),
        JSON.stringify({ error: data.error })
      );
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    if (options.onToken && content) {
      options.onToken(content);
    }
    return {
      content,
      model: data.model ?? options.model,
      finishReason: data.choices?.[0]?.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }

  // SSE streaming with per-chunk inactivity timeout & partial content preservation
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let finishReason: string | undefined;
  let resolvedModel = options.model;

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line || !line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') return;

    let chunk: {
      model?: string;
      error?: { message?: string; code?: number | string };
      choices?: Array<{
        delta?: { content?: string; reasoning?: string; reasoning_content?: string };
        message?: { content?: string };
        finish_reason?: string;
      }>;
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      // Ignore partial SSE comment/keepalive lines
      return;
    }

    if (chunk.error) {
      const mapped = mapHttpError(
        provider,
        statusFromErrorCode(chunk.error.code),
        JSON.stringify({ error: chunk.error })
      );
      if (fullContent) mapped.partialContent = fullContent;
      throw mapped;
    }

    if (chunk.model) resolvedModel = chunk.model;
    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content ?? (!fullContent ? choice?.message?.content : undefined);
    if (delta) {
      fullContent += delta;
      options.onToken?.(delta);
    }
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
      if (finishReason === 'error') {
        throw new AIError({
          code: 'PROVIDER_ERROR',
          message: 'Provider ended the stream with an error.',
          provider,
          partialContent: fullContent || undefined,
        });
      }
    }
  };

  const readChunkWithTimeout = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeoutId = globalThis.setTimeout(() => {
            reader.cancel().catch(() => {});
            reject(
              new AIError({
                code: 'TIMEOUT',
                message: 'Stream stalled without receiving data',
                provider,
                partialContent: fullContent || undefined,
              })
            );
          }, STREAM_CHUNK_TIMEOUT_MS);

          if (options.signal) {
            onAbort = () => {
              if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
              reader.cancel().catch(() => {});
              reject(new DOMException('Aborted', 'AbortError'));
            };
            options.signal.addEventListener('abort', onAbort, { once: true });
          }
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      if (onAbort && options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await readChunkWithTimeout();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        processLine(rawLine);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      processLine(buffer);
    }
  } catch (err) {
    if (options.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (err instanceof AIError) {
      if (!err.partialContent && fullContent) {
        err.partialContent = fullContent;
      }
      throw err;
    }
    throw new AIError({
      code: 'NETWORK',
      message: err instanceof Error ? err.message : 'Stream connection interrupted',
      provider,
      partialContent: fullContent || undefined,
      raw: err,
    });
  }

  return {
    content: fullContent,
    model: resolvedModel,
    finishReason,
  };
}
