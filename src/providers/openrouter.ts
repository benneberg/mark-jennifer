import { APP_NAME } from '../constants';
import { MODEL_METADATA } from '../data/model-metadata';
import type { ChatResult, ModelInfo } from '../types';
import {
  type AIProvider,
  type ChatRequestOptions,
  fetchWithTimeout,
  runOpenAICompatibleChat,
} from './base';
import { AIError, mapHttpError } from './errors';

const BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const referer = typeof window !== 'undefined' ? window.location.origin : 'https://hedetangen.app';
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer': referer,
      'X-Title': APP_NAME,
    };
  }

  async validateKey(): Promise<boolean> {
    const res = await fetchWithTimeout('openrouter', `${BASE_URL}/auth/key`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => '');
      throw mapHttpError('openrouter', res.status, text);
    }
    await this.listModels();
    return true;
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetchWithTimeout('openrouter', `${BASE_URL}/models`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw mapHttpError('openrouter', res.status, text, res.headers.get('retry-after'));
    }

    let data: {
      data?: Array<{
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
        architecture?: { modality?: string };
      }>;
    };
    try {
      data = await res.json();
    } catch (err) {
      throw new AIError({
        code: 'PARSE_ERROR',
        message: 'Failed to parse OpenRouter models response',
        provider: 'openrouter',
        raw: err,
      });
    }

    const prefixMeta = MODEL_METADATA.openrouter;
    const rawList = data.data ?? [];

    const models: ModelInfo[] = rawList
      .filter((m) => {
        const modality = m.architecture?.modality ?? 'text->text';
        return modality.includes('text');
      })
      .map((m) => {
        const isFree = m.pricing?.prompt === '0' && m.pricing?.completion === '0';
        const matchedPrefix = Object.keys(prefixMeta).find((p) => m.id.startsWith(p));
        const hint = matchedPrefix ? prefixMeta[matchedPrefix] : undefined;
        return {
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.context_length,
          free: isFree,
          bestFor: hint?.bestFor,
        };
      });

    // Free models listed first
    models.sort((a, b) => {
      if (Boolean(a.free) !== Boolean(b.free)) return a.free ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    return models;
  }

  async chat(options: ChatRequestOptions): Promise<ChatResult> {
    return runOpenAICompatibleChat('openrouter', BASE_URL, this.headers(), options);
  }
}
