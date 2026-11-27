import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { APP_VERSION, PRIVACY_NOTICE } from '../constants';
import {
  hasStoredKeyRecord,
  isWebCryptoAvailable,
  loadApiKey,
  saveApiKey,
} from '../storage/crypto';
import { getLastModelForProvider } from '../storage/entities';
import type {
  AppSettings,
  LanguagePref,
  ModelInfo,
  ProviderId,
  ResponseMode,
  ThemeMode,
} from '../types';
import { formatDateTime } from '../utils/dates';
import { ConfirmModal } from './ConfirmModal';

interface SettingsPanelProps {
  settings: AppSettings;
  models: ModelInfo[];
  modelsFetchedAt: string | null;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onValidateAndLoadModels: (provider: ProviderId, rawKey: string) => Promise<void>;
  onRefreshModels: () => Promise<void>;
  onOpenExperts: () => void;
  onOpenGuardrails: () => void;
  onOpenImportExport: () => void;
  onClearAllData: () => Promise<void>;
  onUnlockDebug: () => void;
}

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: 'groq', label: 'Groq' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'mock', label: 'Demo' },
];

const LANGUAGES: Array<{ id: LanguagePref; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'sv', label: 'Svenska' },
  { id: 'en', label: 'English' },
  { id: 'bilingual', label: 'Bilingual' },
];

export function SettingsPanel({
  settings,
  models,
  modelsFetchedAt,
  onUpdateSettings,
  onValidateAndLoadModels,
  onRefreshModels,
  onOpenExperts,
  onOpenGuardrails,
  onOpenImportExport,
  onClearAllData,
  onUnlockDebug,
}: SettingsPanelProps) {
  const [keyInput, setKeyInput] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [hasUnreadableKey, setHasUnreadableKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [keyError, setKeyError] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [machineOpen, setMachineOpen] = useState(Boolean(settings.machinePrompt));
  const [machineDraft, setMachineDraft] = useState(settings.machinePrompt);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);

  const cryptoReady = isWebCryptoAvailable();

  useEffect(() => {
    setMachineDraft(settings.machinePrompt);
  }, [settings.machinePrompt]);

  useEffect(() => {
    let active = true;
    setKeyInput('');
    setKeyStatus('idle');
    setKeyError('');
    Promise.all([loadApiKey(settings.provider), hasStoredKeyRecord(settings.provider)]).then(
      ([val, recordExists]) => {
        if (!active) return;
        setHasStoredKey(Boolean(val));
        setHasUnreadableKey(!val && recordExists && settings.provider !== 'mock');
        if (val && settings.provider !== 'mock') {
          setKeyStatus('valid');
        }
      }
    );
    return () => {
      active = false;
    };
  }, [settings.provider]);

  const flashSaved = (label: string) => {
    setSavedNotice(label);
    window.setTimeout(() => setSavedNotice((c) => (c === label ? null : c)), 1600);
  };

  const handleProviderChange = async (provider: ProviderId) => {
    const savedModel = provider === 'mock' ? 'hedetangen-demo-v1' : getLastModelForProvider(provider);
    await onUpdateSettings({
      provider,
      model: savedModel,
    });
    flashSaved('Provider');
  };

  const handleValidateClick = async () => {
    if (!keyInput.trim() && !hasStoredKey) {
      setKeyStatus('invalid');
      setKeyError('Paste an API key first.');
      return;
    }
    setKeyStatus('validating');
    setKeyError('');
    try {
      const effectiveKey = keyInput.trim() || (await loadApiKey(settings.provider)) || '';
      if (!cryptoReady && settings.rememberKey) {
        throw new Error(
          'API keys require a secure context (HTTPS or localhost). Uncheck "Remember key" for session-only use.'
        );
      }
      await saveApiKey(settings.provider, effectiveKey, settings.rememberKey);
      await onValidateAndLoadModels(settings.provider, effectiveKey);
      setHasStoredKey(true);
      setHasUnreadableKey(false);
      setKeyInput('');
      setKeyStatus('valid');
      flashSaved('API key');
    } catch (err) {
      setKeyStatus('invalid');
      setKeyError(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  const filteredModels = models.filter((m) => {
    if (!modelSearch.trim()) return true;
    const q = modelSearch.toLowerCase();
    return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });

  const freeModels = filteredModels.filter((m) => m.free === true);
  const paidOrOtherModels = filteredModels.filter((m) => m.free !== true);

  const selectedModelMeta = models.find((m) => m.id === settings.model);

  const handleVersionTap = () => {
    const next = versionTaps + 1;
    if (next >= 7) {
      setVersionTaps(0);
      onUnlockDebug();
    } else {
      setVersionTaps(next);
    }
  };

  const tempLabel =
    settings.temperature <= 0.35
      ? 'Precise'
      : settings.temperature <= 0.85
        ? 'Balanced'
        : 'Creative';

  return (
    <div className="space-y-5 pb-8">
      {savedNotice && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--lime)] text-[#181817] text-xs font-semibold">
          <Check className="w-3.5 h-3.5" />
          <span>{savedNotice} saved</span>
        </div>
      )}

      {/* 1. Provider */}
      <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)]">1. AI Provider</h3>
        <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`min-h-[38px] px-2 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                settings.provider === p.id
                  ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {settings.provider === 'openai' && (
          <div className="flex items-start gap-2.5 p-3 rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text)]">
            <AlertTriangle className="w-4 h-4 text-[var(--tangerine)] shrink-0 mt-0.5" />
            <span>Paid provider — API usage is billed directly by OpenAI to your account.</span>
          </div>
        )}

        {settings.provider === 'mock' && (
          <div className="p-3 rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
            Demo Mode runs offline in your browser with simulated Hedetangen Brand DNA responses.
          </div>
        )}
      </section>

      {/* 2. API Key */}
      {settings.provider !== 'mock' && (
        <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">2. API Key</h3>
            {hasStoredKey && keyStatus === 'valid' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                <Check className="w-3.5 h-3.5" />
                <span>Saved encrypted</span>
              </span>
            )}
          </div>

          {!cryptoReady && (
            <p className="text-xs text-[var(--danger)]">
              Secure context (HTTPS or localhost) required to persist encrypted keys.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={hasStoredKey ? '•••••••••••••••• (key stored)' : 'Paste your API key'}
              autoComplete="off"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleValidateClick}
              disabled={keyStatus === 'validating'}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {keyStatus === 'validating' ? 'Validating…' : 'Validate & load models'}
            </button>
          </div>

          {hasUnreadableKey && keyStatus !== 'valid' && (
            <p className="text-xs text-[var(--danger)] leading-relaxed">
              A key is stored for this provider, but this browser can no longer decrypt it (browser
              storage was cleared or the secure context changed). Paste the key again to restore
              access.
            </p>
          )}

          {keyStatus === 'invalid' && keyError && (
            <p className="text-xs text-[var(--danger)]">{keyError}</p>
          )}

          <label className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] cursor-pointer select-none pt-0.5">
            <input
              type="checkbox"
              checked={settings.rememberKey}
              onChange={async (e) => {
                await onUpdateSettings({ rememberKey: e.target.checked });
                flashSaved('Key preference');
              }}
              className="w-4 h-4 accent-[#181817] dark:accent-[#EBEE2C]"
            />
            <span>Remember key on this device (AES-GCM encrypted in browser)</span>
          </label>
        </section>
      )}

      {/* 3. Model */}
      {settings.provider !== 'mock' && (
        <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">3. Model</h3>
            <button
              type="button"
              onClick={onRefreshModels}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text)] hover:text-[var(--tangerine)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          <input
            type="search"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            placeholder="Filter models…"
            className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
          />

          <select
            value={settings.model}
            onChange={async (e) => {
              await onUpdateSettings({ model: e.target.value });
              flashSaved('Model');
            }}
            aria-label="Select model"
            className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
          >
            <option value="">— Select a model —</option>
            {freeModels.length > 0 && (
              <optgroup label="Free models">
                {freeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.contextWindow ? ` (${Math.round(m.contextWindow / 1024)}K)` : ''} — Free
                  </option>
                ))}
              </optgroup>
            )}
            {paidOrOtherModels.length > 0 && (
              <optgroup label={settings.provider === 'openai' ? 'Paid models' : 'Other models'}>
                {paidOrOtherModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.contextWindow ? ` (${Math.round(m.contextWindow / 1024)}K)` : ''} — Paid
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {selectedModelMeta && (
            <div className="p-3 rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1">
              <div className="font-mono-tabular text-[var(--text)]">
                {selectedModelMeta.free ? 'Free tier' : 'Paid'}
                {selectedModelMeta.contextWindow
                  ? ` · ${selectedModelMeta.contextWindow.toLocaleString()} ctx`
                  : ''}
                {selectedModelMeta.approxRpm ? ` · ~${selectedModelMeta.approxRpm} RPM` : ''}
                {selectedModelMeta.approxRpd ? ` · ~${selectedModelMeta.approxRpd} RPD` : ''}
              </div>
              {selectedModelMeta.providerNotes && <p>{selectedModelMeta.providerNotes}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={manualModel}
              onChange={(e) => setManualModel(e.target.value)}
              placeholder="Or enter model ID manually…"
              className="flex-1 min-h-[40px] px-3.5 py-1.5 text-xs rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
            />
            <button
              type="button"
              disabled={!manualModel.trim()}
              onClick={async () => {
                await onUpdateSettings({ model: manualModel.trim() });
                setManualModel('');
                flashSaved('Model');
              }}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-full border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
            >
              Use ID
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-faint)]">
            <span>Free-tier limits are indicative and set by the provider.</span>
            {modelsFetchedAt && (
              <span className="font-mono-tabular">Updated {formatDateTime(modelsFetchedAt)}</span>
            )}
          </div>
        </section>
      )}

      {/* 4. Temperature & Response Mode */}
      <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-4">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <h3 className="font-semibold text-[var(--text-muted)]">4. Temperature</h3>
            <span className="font-mono-tabular text-[var(--text)]">
              {settings.temperature.toFixed(1)} · {tempLabel}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={settings.temperature}
            onChange={async (e) => {
              await onUpdateSettings({ temperature: Number(e.target.value) });
              flashSaved('Temperature');
            }}
            aria-label="Temperature"
            className="w-full accent-[#181817] dark:accent-[#EBEE2C]"
          />
        </div>

        {settings.provider !== 'mock' && (
          <div className="space-y-2 pt-1 border-t border-[var(--border)]">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] pt-1">Response Mode</h3>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
              {(
                [
                  { id: 'direct', label: 'Direct (Fast)' },
                  { id: 'team', label: 'Team (Multi-step)' },
                ] as Array<{ id: ResponseMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={async () => {
                    await onUpdateSettings({ responseMode: m.id });
                    flashSaved('Mode');
                  }}
                  className={`min-h-[38px] px-2 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                    (settings.responseMode ?? 'direct') === m.id
                      ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
              {(settings.responseMode ?? 'direct') === 'team'
                ? 'Runs Planner + Specialist Experts + Synthesis (uses more API calls/tokens).'
                : 'Single reliable streaming response with full Brand DNA & studio capabilities.'}
            </p>
          </div>
        )}
      </section>

      {/* 5. Language & Theme */}
      <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">5. Output Language</h3>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={async () => {
                  await onUpdateSettings({ language: l.id });
                  flashSaved('Language');
                }}
                className={`min-h-[38px] px-2 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                  settings.language === l.id
                    ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">Appearance</h3>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
            {(['light', 'dark'] as ThemeMode[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={async () => {
                  await onUpdateSettings({ theme: t });
                  flashSaved('Theme');
                }}
                className={`min-h-[38px] px-3 py-1 text-xs font-semibold rounded-full capitalize transition-all ${
                  settings.theme === t
                    ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Machine Prompt */}
      <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-2.5">
        <button
          type="button"
          onClick={() => setMachineOpen((o) => !o)}
          className="text-xs font-semibold text-[var(--text)] hover:text-[var(--tangerine)] transition-colors"
        >
          {machineOpen ? 'Hide seasonal context prompt' : 'Add seasonal context (machine prompt)'}
        </button>

        {machineOpen && (
          <div className="space-y-2.5 pt-1">
            <textarea
              rows={3}
              maxLength={4000}
              value={machineDraft}
              onChange={(e) => setMachineDraft(e.target.value)}
              placeholder="Optional seasonal context, e.g. 'Summer 2026 campaign, bookings open in March.'"
              className="w-full p-3 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--text-faint)]">
                Appended after Brand DNA guardrails on every turn.
              </span>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateSettings({ machinePrompt: machineDraft });
                  flashSaved('Seasonal context');
                }}
                className="min-h-[36px] px-4 py-1 text-xs font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817]"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Studio Shortcuts */}
      <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-2.5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)]">Studio Configuration</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenGuardrails}
            className="min-h-[42px] px-3 py-2 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border-strong)]"
          >
            Brand Guardrails
          </button>
          <button
            type="button"
            onClick={onOpenExperts}
            className="min-h-[42px] px-3 py-2 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border-strong)]"
          >
            Manage Experts
          </button>
        </div>
      </section>

      {/* 7. Data */}
      <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-2.5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)]">7. Backup &amp; Data</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenImportExport}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border-strong)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export / Import</span>
          </button>
          <button
            type="button"
            onClick={() => setClearModalOpen(true)}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full bg-[var(--tangerine)] text-[#181817] hover:opacity-90"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear all data</span>
          </button>
        </div>
      </section>

      {/* 8. About & Privacy */}
      <section className="px-1 space-y-2 text-xs text-[var(--text-muted)]">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--tangerine)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{PRIVACY_NOTICE}</p>
        </div>
        <button
          type="button"
          onClick={handleVersionTap}
          className="text-[11px] font-mono-tabular text-[var(--text-faint)] hover:text-[var(--text-muted)]"
        >
          Hedetangen AI Studio v{APP_VERSION}
        </button>
      </section>

      <ConfirmModal
        open={clearModalOpen}
        title="Clear all studio data?"
        description="This permanently deletes your encrypted API keys, chats, content library, custom experts, and Brand DNA edits from this browser."
        confirmLabel="Delete everything"
        danger
        requireTypedText="DELETE"
        onConfirm={async () => {
          setClearModalOpen(false);
          await onClearAllData();
        }}
        onCancel={() => setClearModalOpen(false)}
      />
    </div>
  );
}
