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

export async function hasApiKey(provider: ProviderId): Promise<boolean> {
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
