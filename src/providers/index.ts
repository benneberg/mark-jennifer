import { MODEL_CACHE_TTL_MS } from '../constants';
import { hasStoredKeyRecord, loadApiKey } from '../storage/crypto';
import { loadCachedModels, saveCachedModels } from '../storage/entities';
import type { ModelInfo, ProviderId } from '../types';
import type { AIProvider } from './base';
import { AIError } from './errors';
import { GroqProvider } from './groq';
import { MockProvider } from './mock';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';

export async function createProvider(providerId: ProviderId, explicitKey?: string): Promise<AIProvider> {
  if (providerId === 'mock') {
    return new MockProvider();
  }
  const key = explicitKey ?? (await loadApiKey(providerId));
  if (!key) {
    const recordExists = await hasStoredKeyRecord(providerId);
    throw new AIError({
      code: recordExists ? 'KEY_UNREADABLE' : 'KEY_MISSING',
      message: recordExists
        ? `The stored API key for ${providerId} can no longer be decrypted on this device.`
        : `No API key stored for ${providerId}.`,
      provider: providerId,
    });
  }

  switch (providerId) {
    case 'groq':
      return new GroqProvider(key);
    case 'openrouter':
      return new OpenRouterProvider(key);
    case 'openai':
      return new OpenAIProvider(key);
    default:
      return new MockProvider();
  }
}

export async function fetchAndCacheModels(
  providerId: ProviderId,
  options: { forceRefresh?: boolean; explicitKey?: string } = {}
): Promise<{ models: ModelInfo[]; fetchedAt: string; fromCache: boolean }> {
  if (providerId === 'mock') {
    const provider = new MockProvider();
    const models = await provider.listModels();
    return { models, fetchedAt: new Date().toISOString(), fromCache: false };
  }

  if (!options.forceRefresh) {
    const cached = await loadCachedModels(providerId);
    if (cached) {
      const age = Date.now() - Date.parse(cached.fetchedAt);
      if (Number.isFinite(age) && age < MODEL_CACHE_TTL_MS && cached.models.length > 0) {
        return { models: cached.models, fetchedAt: cached.fetchedAt, fromCache: true };
      }
    }
  }

  const provider = await createProvider(providerId, options.explicitKey);
  const models = await provider.listModels();
  const fetchedAt = await saveCachedModels(providerId, models);
  return { models, fetchedAt, fromCache: false };
}
