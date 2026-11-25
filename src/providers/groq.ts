import { MODEL_METADATA } from '../data/model-metadata';
import type { ChatResult, ModelInfo } from '../types';
import {
  type AIProvider,
  type ChatRequestOptions,
  fetchWithTimeout,
  runOpenAICompatibleChat,
} from './base';
import { AIError, mapHttpError } from './errors';

const BASE_URL = 'https://api.groq.com/openai/v1';

export class GroqProvider implements AIProvider {
  readonly id = 'groq' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async validateKey(): Promise<boolean> {
    await this.listModels();
    return true;
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetchWithTimeout('groq', `${BASE_URL}/models`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw mapHttpError('groq', res.status, text, res.headers.get('retry-after'));
    }

    let data: { data?: Array<{ id: string; context_window?: number; active?: boolean }> };
    try {
      data = await res.json();
    } catch (err) {
      throw new AIError({
        code: 'PARSE_ERROR',
        message: 'Failed to parse Groq models response',
        provider: 'groq',
        raw: err,
      });
    }

    const meta = MODEL_METADATA.groq;
    const rawList = data.data ?? [];
    const excluded = ['whisper', 'tts', 'guard', 'safeguard', 'prompt-guard'];

    const models: ModelInfo[] = rawList
      .filter((m) => m.active !== false)
      .filter((m) => !excluded.some((ex) => m.id.toLowerCase().includes(ex)))
      .map((m) => {
        const hint = meta[m.id];
        return {
          id: m.id,
          name: m.id,
          contextWindow: hint?.contextWindow ?? m.context_window,
          free: hint?.free ?? true,
          approxRpm: hint?.approxRpm,
          approxRpd: hint?.approxRpd,
          bestFor: hint?.bestFor,
          providerNotes: hint?.notes,
        };
      });

    models.sort((a, b) => {
      const aKnown = Boolean(meta[a.id]);
      const bKnown = Boolean(meta[b.id]);
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    return models;
  }

  async chat(options: ChatRequestOptions): Promise<ChatResult> {
    return runOpenAICompatibleChat('groq', BASE_URL, this.headers(), options);
  }
}
