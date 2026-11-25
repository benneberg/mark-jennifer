import { MODEL_METADATA } from '../data/model-metadata';
import type { ChatResult, ModelInfo } from '../types';
import {
  type AIProvider,
  type ChatRequestOptions,
  fetchWithTimeout,
  runOpenAICompatibleChat,
} from './base';
import { AIError, mapHttpError } from './errors';

const BASE_URL = 'https://api.openai.com/v1';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
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
    const res = await fetchWithTimeout('openai', `${BASE_URL}/models`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw mapHttpError('openai', res.status, text, res.headers.get('retry-after'));
    }

    let data: { data?: Array<{ id: string }> };
    try {
      data = await res.json();
    } catch (err) {
      throw new AIError({
        code: 'PARSE_ERROR',
        message: 'Failed to parse OpenAI models response',
        provider: 'openai',
        raw: err,
      });
    }

    const meta = MODEL_METADATA.openai;
    const chatPrefixes = ['gpt-', 'o1', 'o3', 'o4'];
    const excludeTerms = ['audio', 'realtime', 'tts', 'transcribe', 'image', 'search', 'instruct'];

    const models: ModelInfo[] = (data.data ?? [])
      .filter((m) => chatPrefixes.some((p) => m.id.startsWith(p)))
      .filter((m) => !excludeTerms.some((ex) => m.id.includes(ex)))
      .map((m) => {
        const hint = meta[m.id];
        return {
          id: m.id,
          name: m.id,
          contextWindow: hint?.contextWindow,
          free: false,
          bestFor: hint?.bestFor,
        };
      });

    models.sort((a, b) => a.id.localeCompare(b.id));
    return models;
  }

  async chat(options: ChatRequestOptions): Promise<ChatResult> {
    return runOpenAICompatibleChat('openai', BASE_URL, this.headers(), options);
  }
}
