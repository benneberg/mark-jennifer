import { REQUEST_TIMEOUT_MS, STREAM_CHUNK_TIMEOUT_MS } from '../constants';
import type { ChatCompletionMessage, ChatResult, ModelInfo, ProviderId } from '../types';
import { AIError, mapHttpError } from './errors';

export interface ChatRequestOptions {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  stage?: 'planner' | 'expert' | 'synthesis';
  responseFormat?: 'json_object';
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

function extractTextContent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const rec = part as { type?: string; text?: unknown; content?: unknown };
          if (rec.type === 'thinking' || rec.type === 'reasoning') return '';
          if (typeof rec.text === 'string') return rec.text;
          if (typeof rec.content === 'string') return rec.content;
        }
        return '';
      })
      .join('');
  }
  return '';
}

function extractBalancedJsonFallback(raw: string): string | null {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!cleaned) return null;
  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = cleaned.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return candidate;
            }
          } catch {
            // keep scanning
          }
          break;
        }
      }
    }
  }
  return null;
}

function usesCompletionTokensParam(provider: ProviderId, model: string): boolean {
  if (provider === 'groq') return false;
  const baseName = model.includes('/') ? (model.split('/').pop() ?? model) : model;
  return /^(?:o1|o3|o4|gpt-5)(?:[-.]|$)/i.test(baseName);
}

export async function runOpenAICompatibleChat(
  provider: ProviderId,
  baseUrl: string,
  headers: Record<string, string>,
  options: ChatRequestOptions
): Promise<ChatResult> {
  const stream = Boolean(options.onToken || options.streamInternal);
  const maxRetries = 3;
  const isReasoning = usesCompletionTokensParam(provider, options.model);
  let useJsonFormat = options.responseFormat === 'json_object' && !stream;
  let useReasoningHint = provider === 'openrouter' && options.responseFormat === 'json_object' && !stream;
  let effectiveMaxTokens = options.maxTokens;
  let emptyRetries = 0;
  let res!: Response;
  let parsedNonStreamResult: ChatResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const payload: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      stream,
    };
    if (isReasoning) {
      if (effectiveMaxTokens !== undefined) {
        payload.max_completion_tokens = effectiveMaxTokens;
      }
    } else {
      payload.temperature = options.temperature ?? 0.7;
      if (effectiveMaxTokens !== undefined) {
        payload.max_tokens = effectiveMaxTokens;
      }
    }
    if (useJsonFormat) {
      payload.response_format = { type: 'json_object' };
    }
    if (useReasoningHint) {
      payload.reasoning = { effort: 'low' };
    }

    res = await fetchWithTimeout(
      provider,
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      },
      options.signal
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');

      if (res.status === 400 || res.status === 422) {
        if (useReasoningHint && /(reasoning|effort|unknown|unrecognized|extra_forbidden|not supported)/i.test(text)) {
          useReasoningHint = false;
          continue;
        }
        if (useJsonFormat && /(response_format|json_object|json mode|structured|not supported)/i.test(text)) {
          useJsonFormat = false;
          continue;
        }
        if (useReasoningHint || useJsonFormat) {
          useReasoningHint = false;
          useJsonFormat = false;
          continue;
        }
      }

      const mapped = mapHttpError(provider, res.status, text, res.headers.get('retry-after'));

      const canRetryRateLimit = mapped.code === 'RATE_LIMIT' && attempt < maxRetries;
      const canRetryTransient =
        mapped.code === 'PROVIDER_ERROR' && isTransientStatus(mapped.status) && attempt < 2;

      if (canRetryRateLimit || canRetryTransient) {
        const fallbackDelay = mapped.code === 'RATE_LIMIT' ? (attempt + 1) * 4000 : (attempt + 1) * 1500;
        const waitMs = Math.min(
          Math.max(1200, (mapped.retryAfterMs ?? fallbackDelay) + 400),
          20000
        );
        options.onRetryWait?.(waitMs, attempt + 1);
        await waitWithAbort(waitMs, options.signal);
        continue;
      }

      throw mapped;
    }

    if (stream && res.body) {
      break;
    }

    let data: {
      error?: { message?: string; code?: number | string };
      choices?: Array<{
        message?: {
          content?: unknown;
          reasoning?: unknown;
          reasoning_content?: unknown;
          refusal?: string;
        };
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
      const statusNum = typeof data.error.code === 'number' ? data.error.code : 500;
      throw mapHttpError(provider, statusNum, JSON.stringify({ error: data.error }));
    }

    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason;
    let content = extractTextContent(choice?.message?.content);
    const reasoningText = extractTextContent(
      choice?.message?.reasoning ?? choice?.message?.reasoning_content
    );

    if (!content.trim() && emptyRetries < 2 && attempt < maxRetries) {
      emptyRetries++;
      useJsonFormat = false;
      if (finishReason === 'length') {
        effectiveMaxTokens = Math.min(
          Math.max((effectiveMaxTokens ?? 2048) * 2, 6144),
          16384
        );
      } else {
        useReasoningHint = false;
      }
      continue;
    }

    if (!content.trim() && options.responseFormat === 'json_object' && reasoningText.trim()) {
      const recovered = extractBalancedJsonFallback(reasoningText);
      if (recovered) {
        content = recovered;
      }
    }

    if (options.onToken && content) {
      options.onToken(content);
    }
    parsedNonStreamResult = {
      content,
      model: data.model ?? options.model,
      finishReason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
    break;
  }

  if (parsedNonStreamResult) {
    return parsedNonStreamResult;
  }

  if (!stream || !res.body) {
    return {
      content: '',
      model: options.model,
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
      const statusNum = typeof chunk.error.code === 'number' ? chunk.error.code : 500;
      const mapped = mapHttpError(provider, statusNum, JSON.stringify({ error: chunk.error }));
      if (fullContent) mapped.partialContent = fullContent;
      throw mapped;
    }

    if (chunk.model) resolvedModel = chunk.model;
    const choice = chunk.choices?.[0];
    const deltaText =
      extractTextContent(choice?.delta?.content) ||
      (!fullContent ? extractTextContent(choice?.message?.content) : '');
    if (deltaText) {
      fullContent += deltaText;
      options.onToken?.(deltaText);
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
