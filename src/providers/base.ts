import { REQUEST_TIMEOUT_MS } from '../constants';
import type { ChatCompletionMessage, ChatResult, ModelInfo, ProviderId } from '../types';
import { AIError, mapHttpError } from './errors';

export interface ChatRequestOptions {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
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
  const timeoutId = globalThis.setTimeout(() => timeoutController.abort('timeout'), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => timeoutController.abort(externalSignal?.reason ?? 'aborted');
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
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (externalSignal?.aborted) throw err;
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

export async function runOpenAICompatibleChat(
  provider: ProviderId,
  baseUrl: string,
  headers: Record<string, string>,
  options: ChatRequestOptions
): Promise<ChatResult> {
  const stream = Boolean(options.onToken);
  const maxRateLimitRetries = 3;
  let res!: Response;

  for (let attempt = 0; attempt <= maxRateLimitRetries; attempt++) {
    res = await fetchWithTimeout(
      provider,
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream,
        }),
      },
      options.signal
    );

    if (res.ok) break;

    const text = await res.text().catch(() => '');
    const mapped = mapHttpError(provider, res.status, text, res.headers.get('retry-after'));

    if (mapped.code === 'RATE_LIMIT' && attempt < maxRateLimitRetries) {
      const fallbackDelay = (attempt + 1) * 4000;
      const waitMs = Math.min(
        Math.max(1500, (mapped.retryAfterMs ?? fallbackDelay) + 400),
        20000
      );
      options.onRetryWait?.(waitMs, attempt + 1);
      await waitWithAbort(waitMs, options.signal);
      continue;
    }

    throw mapped;
  }

  if (!stream || !res.body) {
    let data: {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
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

  // SSE streaming with per-chunk inactivity timeout
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

    try {
      const chunk = JSON.parse(payload) as {
        model?: string;
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
      };
      if (chunk.model) resolvedModel = chunk.model;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        options.onToken?.(delta);
      }
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    } catch {
      // Ignore partial SSE comment/keepalive lines
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
            reader.cancel('stream_timeout').catch(() => {});
            reject(
              new AIError({
                code: 'TIMEOUT',
                message: 'Stream stalled without receiving data',
                provider,
              })
            );
          }, REQUEST_TIMEOUT_MS);

          if (options.signal) {
            onAbort = () => {
              if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
              reader.cancel(options.signal?.reason ?? 'aborted').catch(() => {});
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

  while (true) {
    const { done, value } = await readChunkWithTimeout();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      processLine(rawLine);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processLine(buffer);
  }

  return {
    content: fullContent,
    model: resolvedModel,
    finishReason,
  };
}
