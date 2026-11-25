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
  const timeoutId = window.setTimeout(() => timeoutController.abort('timeout'), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => timeoutController.abort(externalSignal?.reason ?? 'aborted');
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId);
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
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function runOpenAICompatibleChat(
  provider: ProviderId,
  baseUrl: string,
  headers: Record<string, string>,
  options: ChatRequestOptions
): Promise<ChatResult> {
  const stream = Boolean(options.onToken);
  const res = await fetchWithTimeout(
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

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw mapHttpError(provider, res.status, text, res.headers.get('retry-after'));
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

  // SSE streaming
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let finishReason: string | undefined;
  let resolvedModel = options.model;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;

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
    }
  }

  return {
    content: fullContent,
    model: resolvedModel,
    finishReason,
  };
}
