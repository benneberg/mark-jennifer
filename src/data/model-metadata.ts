import type { ProviderId } from '../types';

export interface CuratedModelMeta {
  contextWindow?: number;
  free?: boolean;
  bestFor?: string[];
  approxRpm?: number;
  approxRpd?: number;
  notes?: string;
}

// Last verified: 2026-11-24
export const MODEL_METADATA: Record<ProviderId, Record<string, CuratedModelMeta>> = {
  groq: {
    'llama-3.3-70b-versatile': {
      contextWindow: 131072,
      free: true,
      bestFor: ['copy', 'strategy', 'research-synthesis'],
      approxRpm: 30,
      approxRpd: 1000,
      notes: 'Recommended default. Strong at brand-voice copy.',
    },
    'llama-3.1-8b-instant': {
      contextWindow: 131072,
      free: true,
      bestFor: ['quick-drafts', 'low-latency'],
      approxRpm: 30,
      approxRpd: 14400,
      notes: 'Fastest; lighter model for quick drafts.',
    },
    'openai/gpt-oss-120b': {
      contextWindow: 131072,
      free: true,
      bestFor: ['copy', 'reasoning'],
      approxRpm: 30,
      approxRpd: 1000,
      notes: 'High-quality copy and reasoning on Groq free tier.',
    },
    'moonshotai/kimi-k2-instruct': {
      contextWindow: 131072,
      free: true,
      bestFor: ['long-context', 'research'],
      approxRpm: 60,
      approxRpd: 1000,
      notes: 'Great for long research briefs.',
    },
  },
  openrouter: {
    'deepseek/': { free: true, bestFor: ['reasoning', 'research'] },
    'meta-llama/': { free: true, bestFor: ['copy', 'general'] },
    'qwen/': { free: true, bestFor: ['reasoning', 'multilingual'] },
  },
  openai: {
    'gpt-4o': { free: false, contextWindow: 128000, bestFor: ['copy', 'reasoning'] },
    'gpt-4o-mini': { free: false, contextWindow: 128000, bestFor: ['copy', 'fast'] },
    'gpt-4.1': { free: false, contextWindow: 1000000, bestFor: ['long-context'] },
  },
  mock: {
    'hedetangen-demo-v1': {
      contextWindow: 128000,
      free: true,
      bestFor: ['demo', 'offline-testing'],
      notes: 'Built-in Demo Mode with Brand DNA responses. No API key required.',
    },
  },
};
