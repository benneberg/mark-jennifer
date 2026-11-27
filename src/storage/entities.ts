import { APP_NAME, APP_VERSION, LS_KEYS, SCHEMA_VERSION } from '../constants';
import defaultBusinessJson from '../data/business.json';
import { createSeedExperts } from '../data/seed-experts';
import { createSeedGuardrails, IMMUTABLE_HONESTY_RULE } from '../data/seed-guardrails';
import type {
  AppSettings,
  BusinessProfile,
  CampaignPackage,
  Chat,
  ChatMessage,
  Expert,
  ExportPackage,
  Guardrails,
  LibraryItem,
  ModelInfo,
  ProviderId,
} from '../types';
import { nowIso } from '../utils/dates';
import { generateId } from '../utils/id';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../utils/safe-storage';
import {
  BUSINESS_PROFILE_SCHEMA,
  CAMPAIGN_PACKAGE_SCHEMA,
  CHAT_SCHEMA,
  EXPERT_SCHEMA,
  GUARDRAILS_SCHEMA,
  LIBRARY_ITEM_SCHEMA,
  MESSAGE_SCHEMA,
  SETTINGS_SCHEMA,
  validateSchema,
} from '../utils/validate';
import { clearAllApiKeyMaterial } from './crypto';
import {
  idbClearAllStores,
  idbClearStore,
  idbDelete,
  idbGet,
  idbGetAll,
  idbGetAllByIndex,
  idbPut,
} from './db';

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'groq',
  model: '',
  temperature: 0.7,
  language: 'auto',
  machinePrompt: '',
  theme: 'light',
  rememberKey: true,
  strictMode: true,
  debug: false,
  responseMode: 'direct',
};

interface SettingEntry {
  key: string;
  value: unknown;
}

interface MetaEntry<T = unknown> {
  key: string;
  value: T;
}

export async function ensureSeedData(): Promise<{ skippedCount: number }> {
  let skippedCount = 0;

  // Seed experts if none exist and never seeded before
  const seededFlag = await idbGet<MetaEntry<boolean>>('meta', 'seeded');
  const seedPromptVersion = await idbGet<MetaEntry<number>>('meta', 'seedPromptsVersion');
  const existingExperts = await idbGetAll<Expert>('experts');

  if (!seededFlag?.value && existingExperts.length === 0) {
    const seeds = createSeedExperts(nowIso());
    for (const exp of seeds) {
      const check = validateSchema(exp, EXPERT_SCHEMA);
      if (check.valid) {
        await idbPut('experts', exp);
      } else {
        skippedCount++;
      }
    }
    await idbPut('meta', { key: 'seeded', value: true });
    await idbPut('meta', { key: 'schemaVersion', value: SCHEMA_VERSION });
    await idbPut('meta', { key: 'seedPromptsVersion', value: 3 });
  } else if ((seedPromptVersion?.value ?? 1) < 3) {
    const freshSeeds = createSeedExperts(nowIso());
    const freshById = new Map(freshSeeds.map((s) => [s.id, s]));
    for (const exp of existingExperts) {
      const replacement = freshById.get(exp.id);
      if (replacement && exp.isSeed && exp.updatedAt === exp.createdAt) {
        await idbPut('experts', {
          ...exp,
          systemPrompt: replacement.systemPrompt,
        });
      }
    }
    await idbPut('meta', { key: 'seedPromptsVersion', value: 3 });
  }

  // Seed guardrails if missing
  const existingGuardrails = await idbGet<Guardrails>('guardrails', 'default');
  if (!existingGuardrails) {
    const seedG = createSeedGuardrails(nowIso());
    await idbPut('guardrails', seedG);
  }

  // Seed settings if missing
  const existingSettings = await idbGetAll<SettingEntry>('settings');
  if (existingSettings.length === 0) {
    const themeFromLs = safeGetItem(LS_KEYS.THEME);
    const initial: AppSettings = {
      ...DEFAULT_SETTINGS,
      theme: themeFromLs === 'dark' ? 'dark' : 'light',
    };
    await saveSettings(initial);
  }

  // Crash recovery: rewrite any stuck streaming messages to stopped
  const allMessages = await idbGetAll<ChatMessage>('messages');
  for (const msg of allMessages) {
    if (msg.status === 'streaming') {
      await idbPut('messages', { ...msg, status: 'stopped' });
    }
  }

  return { skippedCount };
}

export async function loadExperts(): Promise<{ experts: Expert[]; skipped: number }> {
  const raw = await idbGetAll<Expert>('experts');
  const valid: Expert[] = [];
  let skipped = 0;
  for (const item of raw) {
    if (validateSchema(item, EXPERT_SCHEMA).valid) {
      valid.push(item);
    } else {
      skipped++;
    }
  }
  valid.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { experts: valid, skipped };
}

export async function saveExpert(expert: Expert): Promise<void> {
  const check = validateSchema(expert, EXPERT_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut('experts', expert);
}

export async function removeExpert(id: string): Promise<void> {
  await idbDelete('experts', id);
}

export async function loadGuardrails(): Promise<Guardrails> {
  const record = await idbGet<Guardrails>('guardrails', 'default');
  if (record && validateSchema(record, GUARDRAILS_SCHEMA).valid) {
    // Always enforce canonical honesty rule
    return { ...record, honestyRule: IMMUTABLE_HONESTY_RULE };
  }
  const fallback = createSeedGuardrails(nowIso());
  await idbPut('guardrails', fallback);
  return fallback;
}

export async function saveGuardrails(next: Guardrails): Promise<Guardrails> {
  const enforced: Guardrails = {
    ...next,
    id: 'default',
    honestyRule: IMMUTABLE_HONESTY_RULE,
    updatedAt: nowIso(),
  };
  const check = validateSchema(enforced, GUARDRAILS_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut('guardrails', enforced);
  return enforced;
}

export async function loadSettings(): Promise<AppSettings> {
  const entries = await idbGetAll<SettingEntry>('settings');
  const map: Record<string, unknown> = {};
  for (const entry of entries) {
    map[entry.key] = entry.value;
  }
  const merged: AppSettings = {
    provider: (map.provider as ProviderId) ?? DEFAULT_SETTINGS.provider,
    model: typeof map.model === 'string' ? map.model : DEFAULT_SETTINGS.model,
    temperature: typeof map.temperature === 'number' ? map.temperature : DEFAULT_SETTINGS.temperature,
    language: (map.language as AppSettings['language']) ?? DEFAULT_SETTINGS.language,
    machinePrompt:
      typeof map.machinePrompt === 'string' ? map.machinePrompt : DEFAULT_SETTINGS.machinePrompt,
    theme: map.theme === 'dark' ? 'dark' : 'light',
    rememberKey: typeof map.rememberKey === 'boolean' ? map.rememberKey : DEFAULT_SETTINGS.rememberKey,
    strictMode: true,
    debug: typeof map.debug === 'boolean' ? map.debug : DEFAULT_SETTINGS.debug,
    responseMode: map.responseMode === 'team' ? 'team' : 'direct',
  };
  return merged;
}

export function getLastModelForProvider(provider: ProviderId): string {
  if (provider === 'mock') return 'hedetangen-demo-v1';
  try {
    const raw = safeGetItem(LS_KEYS.LAST_MODEL_BY_PROVIDER);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed[provider] === 'string' ? parsed[provider] : '';
  } catch {
    return '';
  }
}

function saveLastModelForProvider(provider: ProviderId, model: string): void {
  if (!model.trim() || provider === 'mock') return;
  try {
    const raw = safeGetItem(LS_KEYS.LAST_MODEL_BY_PROVIDER);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[provider] = model.trim();
    safeSetItem(LS_KEYS.LAST_MODEL_BY_PROVIDER, JSON.stringify(parsed));
  } catch {
    // Non-fatal
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const normalized: AppSettings = {
    ...settings,
    strictMode: true,
    responseMode: settings.responseMode === 'team' ? 'team' : 'direct',
  };
  const check = validateSchema(normalized, SETTINGS_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  const entries = Object.entries(normalized);
  for (const [key, value] of entries) {
    await idbPut<SettingEntry>('settings', { key, value });
  }
  safeSetItem(LS_KEYS.THEME, normalized.theme);
  safeSetItem(LS_KEYS.LAST_PROVIDER, normalized.provider);
  safeSetItem(LS_KEYS.LAST_MODEL, normalized.model);
  saveLastModelForProvider(normalized.provider, normalized.model);
}

export async function loadAllChats(): Promise<Chat[]> {
  const chats = await idbGetAll<Chat>('chats');
  const validChats = chats.filter((c) => validateSchema(c, CHAT_SCHEMA).valid);
  validChats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return validChats;
}

export async function getOrCreateActiveChat(): Promise<Chat> {
  const validChats = await loadAllChats();
  if (validChats.length > 0) {
    return validChats[0];
  }
  return createNewChat();
}

export async function createNewChat(title = 'New marketing session'): Promise<Chat> {
  const ts = nowIso();
  const chat: Chat = {
    id: generateId(),
    title: title.slice(0, 120) || 'New marketing session',
    createdAt: ts,
    updatedAt: ts,
  };
  await idbPut('chats', chat);
  return chat;
}

function sanitizeChatForStorage(chat: Chat): Chat {
  const facts = chat.sessionFacts
    ? {
        ...(chat.sessionFacts.constraints
          ? { constraints: chat.sessionFacts.constraints.slice(0, 20).map((s) => s.slice(0, 300)) }
          : {}),
        ...(chat.sessionFacts.audience
          ? { audience: chat.sessionFacts.audience.slice(0, 20).map((s) => s.slice(0, 300)) }
          : {}),
        ...(chat.sessionFacts.budget
          ? { budget: chat.sessionFacts.budget.slice(0, 200) }
          : {}),
        ...(chat.sessionFacts.awards
          ? { awards: chat.sessionFacts.awards.slice(0, 20).map((s) => s.slice(0, 300)) }
          : {}),
        ...(chat.sessionFacts.channels
          ? { channels: chat.sessionFacts.channels.slice(0, 20).map((s) => s.slice(0, 120)) }
          : {}),
        ...(chat.sessionFacts.focus
          ? { focus: chat.sessionFacts.focus.slice(0, 400) }
          : {}),
        ...(chat.sessionFacts.referencePhoto
          ? { referencePhoto: chat.sessionFacts.referencePhoto.slice(0, 1000) }
          : {}),
        ...(chat.sessionFacts.notes
          ? { notes: chat.sessionFacts.notes.slice(0, 20).map((s) => s.slice(0, 300)) }
          : {}),
      }
    : undefined;

  return {
    ...chat,
    title: (chat.title || 'New marketing session').slice(0, 120),
    ...(facts && Object.keys(facts).length > 0 ? { sessionFacts: facts } : { sessionFacts: undefined }),
  };
}

export async function updateChat(chat: Chat): Promise<void> {
  const sanitized = sanitizeChatForStorage(chat);
  const check = validateSchema(sanitized, CHAT_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut('chats', sanitized);
}

export async function deleteChat(chatId: string): Promise<void> {
  await clearChatMessages(chatId);
  await idbDelete('chats', chatId);
}

export async function loadMessagesForChat(chatId: string): Promise<ChatMessage[]> {
  const raw = await idbGetAllByIndex<ChatMessage>('messages', 'chatId', chatId);
  const valid = raw.filter((m) => validateSchema(m, MESSAGE_SCHEMA).valid);
  valid.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return valid;
}

export async function saveMessage(msg: ChatMessage): Promise<void> {
  const sanitized: ChatMessage = {
    ...msg,
    content: (msg.content || ' ').slice(0, 60000),
    ...(msg.handoffText !== undefined
      ? { handoffText: msg.handoffText.slice(0, 2000) }
      : {}),
    ...(msg.delegatedExperts !== undefined
      ? { delegatedExperts: msg.delegatedExperts.slice(0, 10).map((e) => e.slice(0, 60)) }
      : {}),
  };
  const check = validateSchema(sanitized, MESSAGE_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut('messages', sanitized);
}

export async function deleteMessage(id: string): Promise<void> {
  await idbDelete('messages', id);
}

export async function clearChatMessages(chatId: string): Promise<void> {
  const existing = await idbGetAllByIndex<ChatMessage>('messages', 'chatId', chatId);
  for (const msg of existing) {
    await idbDelete('messages', msg.id);
  }
}

export async function loadLibrary(): Promise<{ items: LibraryItem[]; skipped: number }> {
  const raw = await idbGetAll<LibraryItem>('library');
  const items: LibraryItem[] = [];
  let skipped = 0;
  for (const item of raw) {
    if (validateSchema(item, LIBRARY_ITEM_SCHEMA).valid) {
      items.push(item);
    } else {
      skipped++;
    }
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, skipped };
}

export async function saveLibraryItem(item: LibraryItem): Promise<void> {
  const check = validateSchema(item, LIBRARY_ITEM_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut('library', item);
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await idbDelete('library', id);
}

export function getDefaultBusinessProfile(): BusinessProfile {
  return structuredClone(defaultBusinessJson) as BusinessProfile;
}

export async function loadBusinessProfile(): Promise<BusinessProfile> {
  const entry = await idbGet<MetaEntry<BusinessProfile>>('meta', 'businessProfile');
  if (entry?.value && validateSchema(entry.value, BUSINESS_PROFILE_SCHEMA).valid) {
    return entry.value;
  }
  const fallback = getDefaultBusinessProfile();
  await idbPut<MetaEntry<BusinessProfile>>('meta', {
    key: 'businessProfile',
    value: fallback,
  });
  return fallback;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<BusinessProfile> {
  const next: BusinessProfile = {
    ...profile,
    updatedAt: nowIso(),
  };
  const check = validateSchema(next, BUSINESS_PROFILE_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut<MetaEntry<BusinessProfile>>('meta', {
    key: 'businessProfile',
    value: next,
  });
  return next;
}

export async function resetBusinessProfile(): Promise<BusinessProfile> {
  const fresh: BusinessProfile = {
    ...getDefaultBusinessProfile(),
    updatedAt: nowIso(),
  };
  await idbPut<MetaEntry<BusinessProfile>>('meta', {
    key: 'businessProfile',
    value: fresh,
  });
  return fresh;
}

export async function loadPackages(): Promise<CampaignPackage[]> {
  const raw = await idbGetAll<CampaignPackage>('packages');
  const valid = raw.filter((p) => validateSchema(p, CAMPAIGN_PACKAGE_SCHEMA).valid);
  valid.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return valid;
}

export async function savePackage(pkg: CampaignPackage): Promise<void> {
  const check = validateSchema(pkg, CAMPAIGN_PACKAGE_SCHEMA);
  if (!check.valid) {
    throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  await idbPut('packages', pkg);
}

export async function deletePackage(id: string): Promise<void> {
  await idbDelete('packages', id);
}

export interface CachedModelsRecord {
  models: ModelInfo[];
  fetchedAt: string;
}

export async function loadCachedModels(provider: ProviderId): Promise<CachedModelsRecord | null> {
  const record = await idbGet<MetaEntry<CachedModelsRecord>>('meta', `models.${provider}`);
  return record?.value ?? null;
}

export async function saveCachedModels(provider: ProviderId, models: ModelInfo[]): Promise<string> {
  const fetchedAt = nowIso();
  await idbPut<MetaEntry<CachedModelsRecord>>('meta', {
    key: `models.${provider}`,
    value: { models, fetchedAt },
  });
  return fetchedAt;
}

export async function buildExportPackage(includeChats: boolean): Promise<ExportPackage> {
  const [{ experts }, guardrails, { items: library }, settings, businessProfile, packages] =
    await Promise.all([
      loadExperts(),
      loadGuardrails(),
      loadLibrary(),
      loadSettings(),
      loadBusinessProfile(),
      loadPackages(),
    ]);

  const { rememberKey: _omit, ...exportableSettings } = settings;
  void _omit;

  const pkg: ExportPackage = {
    schemaVersion: 1,
    exportedAt: nowIso(),
    app: {
      name: APP_NAME,
      version: APP_VERSION,
    },
    experts,
    guardrails,
    library,
    settings: exportableSettings,
    businessProfile,
    packages,
  };

  if (includeChats) {
    const allChats = await idbGetAll<Chat>('chats');
    const validChats = allChats.filter((c) => validateSchema(c, CHAT_SCHEMA).valid);
    const chatsWithMsgs = [];
    for (const chat of validChats) {
      const messages = await loadMessagesForChat(chat.id);
      chatsWithMsgs.push({ chat, messages });
    }
    pkg.chats = chatsWithMsgs;
  }

  return pkg;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary?: {
    expertsCount: number;
    libraryCount: number;
    chatsCount: number;
    guardrailsChanged: boolean;
  };
  parsed?: ExportPackage;
}

export async function validateImportPackage(rawText: string): Promise<ImportValidationResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return { valid: false, errors: ['File is not valid JSON.'], warnings: [] };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ['Root JSON value must be an object.'], warnings: [] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Security check: reject payloads containing key fields
  const forbiddenKeys = ['keys', 'apiKey', 'apiKeys', 'crypto', 'masterKey', 'rememberKey'];
  for (const fk of forbiddenKeys) {
    if (fk in obj) {
      errors.push(`Security error: import payload cannot contain "${fk}".`);
    }
  }
  if (
    typeof obj.settings === 'object' &&
    obj.settings !== null &&
    'rememberKey' in (obj.settings as Record<string, unknown>)
  ) {
    errors.push('Security error: settings in import payload cannot contain "rememberKey".');
  }

  if (obj.schemaVersion !== 1) {
    errors.push(`Unsupported schemaVersion "${String(obj.schemaVersion)}". Expected 1.`);
  }

  if (
    typeof obj.app !== 'object' ||
    obj.app === null ||
    (obj.app as Record<string, unknown>).name !== APP_NAME
  ) {
    errors.push(`Invalid app.name. Expected "${APP_NAME}".`);
  }

  if (!Array.isArray(obj.experts)) {
    errors.push('experts: must be an array.');
  } else {
    obj.experts.forEach((exp, idx) => {
      const res = validateSchema(exp, EXPERT_SCHEMA, `experts[${idx}]`, {
        relaxAdditionalProperties: true,
      });
      res.errors.forEach((e) => errors.push(`Expert #${idx + 1} (${e.path}): ${e.message}`));
      if (res.strippedFields?.length) {
        warnings.push(`Ignored unrecognized fields in Expert #${idx + 1}.`);
      }
    });
  }

  if (obj.guardrails === undefined) {
    errors.push('guardrails: is required.');
  } else {
    const res = validateSchema(obj.guardrails, GUARDRAILS_SCHEMA, 'guardrails', {
      relaxAdditionalProperties: true,
    });
    res.errors.forEach((e) => errors.push(`Guardrails (${e.path}): ${e.message}`));
  }

  if (!Array.isArray(obj.library)) {
    errors.push('library: must be an array.');
  } else {
    obj.library.forEach((item, idx) => {
      const res = validateSchema(item, LIBRARY_ITEM_SCHEMA, `library[${idx}]`, {
        relaxAdditionalProperties: true,
      });
      res.errors.forEach((e) => errors.push(`Library item #${idx + 1} (${e.path}): ${e.message}`));
    });
  }

  if (obj.settings === undefined) {
    errors.push('settings: is required.');
  } else {
    const res = validateSchema(obj.settings, SETTINGS_SCHEMA, 'settings', {
      relaxAdditionalProperties: true,
    });
    res.errors.forEach((e) => errors.push(`Settings (${e.path}): ${e.message}`));
  }

  if (obj.chats !== undefined) {
    if (!Array.isArray(obj.chats)) {
      errors.push('chats: must be an array when present.');
    } else {
      obj.chats.forEach((entry, idx) => {
        if (typeof entry !== 'object' || entry === null) {
          errors.push(`Chat #${idx + 1}: must be an object.`);
          return;
        }
        const rec = entry as { chat?: unknown; messages?: unknown };
        const chatRes = validateSchema(rec.chat, CHAT_SCHEMA, `chats[${idx}].chat`, {
          relaxAdditionalProperties: true,
        });
        chatRes.errors.forEach((e) => errors.push(`Chat #${idx + 1} (${e.path}): ${e.message}`));
        if (!Array.isArray(rec.messages)) {
          errors.push(`Chat #${idx + 1}: messages must be an array.`);
        } else {
          rec.messages.forEach((m, mIdx) => {
            const mRes = validateSchema(m, MESSAGE_SCHEMA, `chats[${idx}].messages[${mIdx}]`, {
              relaxAdditionalProperties: true,
            });
            mRes.errors.forEach((e) =>
              errors.push(`Chat #${idx + 1} Message #${mIdx + 1}: ${e.message}`)
            );
          });
        }
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const parsed = obj as unknown as ExportPackage;
  const currentGuardrails = await loadGuardrails();
  const guardrailsChanged =
    JSON.stringify(currentGuardrails.editable) !== JSON.stringify(parsed.guardrails.editable);

  return {
    valid: true,
    errors: [],
    warnings,
    parsed,
    summary: {
      expertsCount: parsed.experts.length,
      libraryCount: parsed.library.length,
      chatsCount: parsed.chats?.length ?? 0,
      guardrailsChanged,
    },
  };
}

export async function applyImportPackage(
  pkg: ExportPackage,
  mode: 'merge' | 'replace'
): Promise<void> {
  if (mode === 'replace') {
    await idbClearStore('experts');
    await idbClearStore('library');
    if (pkg.chats && pkg.chats.length > 0) {
      await idbClearStore('chats');
      await idbClearStore('messages');
    }
  }

  // Experts
  if (mode === 'merge') {
    const { experts: existing } = await loadExperts();
    const byId = new Map(existing.map((e) => [e.id, e]));
    for (const incoming of pkg.experts) {
      const prev = byId.get(incoming.id);
      if (!prev || incoming.updatedAt > prev.updatedAt) {
        await saveExpert(incoming);
      }
    }
  } else {
    for (const incoming of pkg.experts) {
      await saveExpert(incoming);
    }
  }

  // Guardrails (always preserve canonical honestyRule)
  await saveGuardrails({
    ...pkg.guardrails,
    honestyRule: IMMUTABLE_HONESTY_RULE,
  });

  // Library
  if (mode === 'merge') {
    const { items: existing } = await loadLibrary();
    const byId = new Map(existing.map((i) => [i.id, i]));
    for (const incoming of pkg.library) {
      const prev = byId.get(incoming.id);
      const incDate = incoming.updatedAt ?? incoming.createdAt;
      const prevDate = prev ? prev.updatedAt ?? prev.createdAt : '';
      if (!prev || incDate > prevDate) {
        await saveLibraryItem(incoming);
      }
    }
  } else {
    for (const incoming of pkg.library) {
      await saveLibraryItem(incoming);
    }
  }

  // Settings (preserve local rememberKey)
  const currentSettings = await loadSettings();
  await saveSettings({
    ...pkg.settings,
    rememberKey: currentSettings.rememberKey,
    strictMode: true,
  });

  if (pkg.businessProfile && validateSchema(pkg.businessProfile, BUSINESS_PROFILE_SCHEMA).valid) {
    await saveBusinessProfile(pkg.businessProfile);
  }

  if (Array.isArray(pkg.packages)) {
    if (mode === 'replace') {
      await idbClearStore('packages');
    }
    for (const incomingPkg of pkg.packages) {
      if (validateSchema(incomingPkg, CAMPAIGN_PACKAGE_SCHEMA).valid) {
        await idbPut('packages', incomingPkg);
      }
    }
  }

  // Optional chats
  if (pkg.chats && pkg.chats.length > 0) {
    for (const entry of pkg.chats) {
      await idbPut('chats', entry.chat);
      for (const m of entry.messages) {
        await idbPut('messages', m);
      }
    }
  }
}

export async function clearAllStudioData(): Promise<void> {
  await clearAllApiKeyMaterial();
  await idbClearAllStores();
  safeRemoveItem(LS_KEYS.THEME);
  safeRemoveItem(LS_KEYS.LAST_PROVIDER);
  safeRemoveItem(LS_KEYS.LAST_MODEL);
  safeRemoveItem(LS_KEYS.LAST_MODEL_BY_PROVIDER);
  safeRemoveItem(LS_KEYS.ONBOARDED);
  safeRemoveItem(LS_KEYS.RAIL_PINNED);
}
