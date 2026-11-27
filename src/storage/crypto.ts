import type { ProviderId } from '../types';
import { idbDelete, idbGet, idbPut } from './db';

interface CryptoRecord {
  id: 'master';
  key: CryptoKey;
}

interface EncryptedKeyRecord {
  provider: ProviderId;
  iv: number[];
  ciphertext: number[];
  createdAt: string;
}

const sessionKeys = new Map<ProviderId, string>();

/**
 * Single-flight guard: two concurrent saves must never generate two different
 * master keys, otherwise the first ciphertext becomes permanently unreadable.
 */
let masterKeyPromise: Promise<CryptoKey> | null = null;

export function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.isSecureContext) &&
    Boolean(window.crypto?.subtle)
  );
}

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error(
      'API keys require a secure context (HTTPS or localhost). Please open the app over HTTPS.'
    );
  }
  if (!masterKeyPromise) {
    masterKeyPromise = (async () => {
      const existing = await idbGet<CryptoRecord>('crypto', 'master');
      if (existing?.key) {
        return existing.key;
      }
      const masterKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt']
      );
      await idbPut<CryptoRecord>('crypto', { id: 'master', key: masterKey });
      return masterKey;
    })().catch((err) => {
      masterKeyPromise = null;
      throw err;
    });
  }
  return masterKeyPromise;
}

async function decryptStoredKey(provider: ProviderId): Promise<string | null> {
  const record = await idbGet<EncryptedKeyRecord>('keys', provider);
  if (!record) return null;
  if (!isWebCryptoAvailable()) return null;

  const masterRecord = await idbGet<CryptoRecord>('crypto', 'master');
  if (!masterRecord?.key) return null;

  try {
    const iv = new Uint8Array(record.iv);
    const ciphertext = new Uint8Array(record.ciphertext);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterRecord.key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function saveApiKey(
  provider: ProviderId,
  apiKey: string,
  rememberOnDevice: boolean
): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await deleteApiKey(provider);
    return;
  }

  if (!rememberOnDevice) {
    sessionKeys.set(provider, trimmed);
    await idbDelete('keys', provider);
    return;
  }

  sessionKeys.delete(provider);
  const masterKey = await getOrCreateMasterKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(trimmed);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoded
  );

  await idbPut<EncryptedKeyRecord>('keys', {
    provider,
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encrypted)),
    createdAt: new Date().toISOString(),
  });
}

export async function loadApiKey(provider: ProviderId): Promise<string | null> {
  if (provider === 'mock') return 'demo-mode';
  const sessionKey = sessionKeys.get(provider);
  if (sessionKey) return sessionKey;
  return decryptStoredKey(provider);
}

/**
 * True only when a key is actually usable. A stored-but-undecryptable ciphertext
 * (e.g. the master key record was cleared) must report false so the UI can ask
 * the owner to re-enter the key instead of failing every request with 401.
 */
export async function hasApiKey(provider: ProviderId): Promise<boolean> {
  if (provider === 'mock') return true;
  if (sessionKeys.has(provider)) return true;
  return (await decryptStoredKey(provider)) !== null;
}

export async function hasStoredKeyRecord(provider: ProviderId): Promise<boolean> {
  if (provider === 'mock') return true;
  if (sessionKeys.has(provider)) return true;
  const record = await idbGet<EncryptedKeyRecord>('keys', provider);
  return Boolean(record);
}

export async function deleteApiKey(provider: ProviderId): Promise<void> {
  sessionKeys.delete(provider);
  await idbDelete('keys', provider);
}

export function clearSessionKeys(): void {
  sessionKeys.clear();
}

/**
 * Wipes every key material this module owns: in-memory session keys (which
 * otherwise survive "Clear all data" until a page reload) and the cached
 * master-key promise.
 */
export async function clearAllApiKeyMaterial(): Promise<void> {
  sessionKeys.clear();
  masterKeyPromise = null;
  await idbDelete('keys', 'groq').catch(() => {});
  await idbDelete('keys', 'openrouter').catch(() => {});
  await idbDelete('keys', 'openai').catch(() => {});
  await idbDelete('crypto', 'master').catch(() => {});
}
