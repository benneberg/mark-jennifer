import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { ChatList } from './components/ChatList';
import { Composer } from './components/Composer';
import { ConfirmModal } from './components/ConfirmModal';
import { DebugDrawer } from './components/DebugDrawer';
import { ExpertEditor } from './components/ExpertEditor';
import { GuardrailsEditor } from './components/GuardrailsEditor';
import { ImportExportModal } from './components/ImportExportModal';
import { LibraryPanel } from './components/LibraryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastContainer } from './components/ToastContainer';
import { Wizard } from './components/Wizard';
import { LS_KEYS } from './constants';
import { createSeedGuardrails } from './data/seed-guardrails';
import { runJenniferTurn } from './orchestration/jennifer';
import { createProvider, fetchAndCacheModels } from './providers';
import { AIError } from './providers/errors';
import { hasApiKey, saveApiKey } from './storage/crypto';
import {
  clearAllStudioData,
  clearChatMessages,
  createNewChat,
  DEFAULT_SETTINGS,
  deleteLibraryItem,
  ensureSeedData,
  getOrCreateActiveChat,
  loadExperts,
  loadGuardrails,
  loadLibrary,
  loadMessagesForChat,
  loadSettings,
  removeExpert,
  saveExpert,
  saveGuardrails,
  saveLibraryItem,
  saveMessage,
  saveSettings,
  updateChat,
} from './storage/entities';
import type {
  ActivePanel,
  AppSettings,
  Chat,
  ChatMessage,
  DebugEntry,
  Expert,
  Guardrails,
  LibraryItem,
  LibraryItemType,
  ModelInfo,
  ProviderId,
  ToastItem,
} from './types';
import { nowIso } from './utils/dates';
import { generateId } from './utils/id';

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsFetchedAt, setModelsFetchedAt] = useState<string | null>(null);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrails>(() => createSeedGuardrails());
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [referencePhoto, setReferencePhoto] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [railPinned, setRailPinned] = useState<boolean>(
    () => localStorage.getItem(LS_KEYS.RAIL_PINNED) === 'true'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [debugOpen, setDebugOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
  );
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);

  const [streamingState, setStreamingState] = useState<{
    active: boolean;
    status: string | null;
    handoffText: string | null;
    expertLabel: string | null;
    buffer: string;
  }>({
    active: false,
    status: null,
    handoffText: null,
    expertLabel: null,
    buffer: '',
  });

  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef('');
  const handoffTextRef = useRef<string | null>(null);
  const delegatedExpertsRef = useRef<string[]>([]);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  const pushToast = useCallback(
    (message: string, variant: ToastItem['variant'] = 'info') => {
      const id = generateId();
      setToasts((prev) => [{ id, message, variant }, ...prev].slice(0, 3));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const addDebugEntry = useCallback((entry: Omit<DebugEntry, 'id' | 'timestamp'>) => {
    setDebugEntries((prev) =>
      [{ id: generateId(), timestamp: nowIso(), ...entry }, ...prev].slice(0, 40)
    );
  }, []);

  // Sync theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const bootstrapStudio = useCallback(async () => {
    setLoadingChat(true);
    try {
      const { skippedCount } = await ensureSeedData();
      const [loadedSettings, expRes, loadedGuardrails, libRes, chat] = await Promise.all([
        loadSettings(),
        loadExperts(),
        loadGuardrails(),
        loadLibrary(),
        getOrCreateActiveChat(),
      ]);

      const msgs = await loadMessagesForChat(chat.id);
      const keyPresent = await hasApiKey(loadedSettings.provider);

      setSettings(loadedSettings);
      setExperts(expRes.experts);
      setGuardrails(loadedGuardrails);
      setLibrary(libRes.items);
      setActiveChat(chat);
      setMessages(msgs);
      setHasKey(keyPresent);

      if (skippedCount > 0 || expRes.skipped > 0 || libRes.skipped > 0) {
        pushToast(
          'One item could not be loaded and was skipped. Export your data to back up what is readable.',
          'danger'
        );
      }

      if (keyPresent) {
        try {
          const cached = await fetchAndCacheModels(loadedSettings.provider);
          setModels(cached.models);
          setModelsFetchedAt(cached.fetchedAt);
        } catch {
          // Non-fatal on boot
        }
      }
    } finally {
      setLoadingChat(false);
      setReady(true);
    }
  }, [pushToast]);

  useEffect(() => {
    bootstrapStudio();
  }, [bootstrapStudio]);

  // If pinned rail on desktop and nothing open, default rail to library
  useEffect(() => {
    if (railPinned && activePanel === null && window.innerWidth >= 1100) {
      setActivePanel('library');
    }
  }, [railPinned, activePanel]);

  const handleUpdateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const prev = settings;
      const next: AppSettings = { ...settings, ...patch, strictMode: true };
      setSettings(next);
      try {
        await saveSettings(next);
        const keyPresent = await hasApiKey(next.provider);
        setHasKey(keyPresent);
        if (patch.provider && patch.provider !== prev.provider) {
          if (next.provider === 'mock') {
            const demoModels = await fetchAndCacheModels('mock');
            setModels(demoModels.models);
            setModelsFetchedAt(demoModels.fetchedAt);
          } else if (keyPresent) {
            try {
              const res = await fetchAndCacheModels(next.provider);
              setModels(res.models);
              setModelsFetchedAt(res.fetchedAt);
            } catch {
              setModels([]);
            }
          } else {
            setModels([]);
            setModelsFetchedAt(null);
          }
        }
      } catch {
        setSettings(prev);
        pushToast('Failed to save settings to IndexedDB.', 'danger');
      }
    },
    [settings, pushToast]
  );

  const handleEnableDemoMode = useCallback(async () => {
    await handleUpdateSettings({
      provider: 'mock',
      model: 'hedetangen-demo-v1',
    });
    const demoModels = await fetchAndCacheModels('mock');
    setModels(demoModels.models);
    setModelsFetchedAt(demoModels.fetchedAt);
    setHasKey(true);
    localStorage.setItem(LS_KEYS.ONBOARDED, 'true');
    pushToast('Demo Mode active — try asking Jennifer anything.', 'success');
  }, [handleUpdateSettings, pushToast]);

  const handleValidateAndLoadModels = useCallback(
    async (providerId: ProviderId, rawKey: string) => {
      const provider = await createProvider(providerId, rawKey);
      await provider.validateKey();
      const res = await fetchAndCacheModels(providerId, { forceRefresh: true, explicitKey: rawKey });
      setModels(res.models);
      setModelsFetchedAt(res.fetchedAt);
      setHasKey(true);
      if (!settings.model && res.models.length > 0) {
        const preferred =
          res.models.find((m) => m.id === 'llama-3.3-70b-versatile') ??
          res.models.find((m) => m.free) ??
          res.models[0];
        if (preferred) {
          await handleUpdateSettings({ model: preferred.id });
        }
      }
      localStorage.setItem(LS_KEYS.ONBOARDED, 'true');
      pushToast(`Loaded ${res.models.length} models.`, 'success');
    },
    [handleUpdateSettings, pushToast, settings.model]
  );

  const handleRefreshModels = useCallback(async () => {
    try {
      const res = await fetchAndCacheModels(settings.provider, { forceRefresh: true });
      setModels(res.models);
      setModelsFetchedAt(res.fetchedAt);
      pushToast(`Refreshed ${res.models.length} models.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not refresh models.', 'danger');
    }
  }, [pushToast, settings.provider]);

  const isConfigured = useMemo(() => {
    if (settings.provider === 'mock') return true;
    return hasKey && settings.model.trim().length > 0;
  }, [settings.provider, settings.model, hasKey]);

  const altModelId = useMemo(() => {
    const candidates = models.filter((m) => m.id !== settings.model && (settings.provider === 'openai' || m.free));
    return candidates[0]?.id;
  }, [models, settings.model, settings.provider]);

  const executeTurn = useCallback(
    async (userText: string, overrideSettings?: AppSettings) => {
      const trimmed = userText.trim();
      if (!trimmed || !activeChat || streamingState.active) return;

      const activeSettings = overrideSettings ?? settings;
      const turnId = generateId();
      const userMsg: ChatMessage = {
        id: generateId(),
        chatId: activeChat.id,
        role: 'user',
        content: trimmed,
        timestamp: nowIso(),
        status: 'complete',
        turnId,
      };

      const prevHistory = messages;
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      await saveMessage(userMsg);

      if (prevHistory.length === 0) {
        const nextTitle = trimmed.slice(0, 60);
        const updatedChat = { ...activeChat, title: nextTitle, updatedAt: nowIso() };
        setActiveChat(updatedChat);
        await updateChat(updatedChat);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      streamBufferRef.current = '';
      handoffTextRef.current = null;
      delegatedExpertsRef.current = [];

      setStreamingState({
        active: true,
        status: 'Jennifer is thinking…',
        handoffText: null,
        expertLabel: null,
        buffer: '',
      });

      try {
        const result = await runJenniferTurn({
          userMessage: trimmed,
          history: prevHistory,
          sessionFacts: activeChat.sessionFacts,
          referencePhoto: referencePhoto.trim(),
          settings: activeSettings,
          guardrails,
          experts,
          signal: controller.signal,
          callbacks: {
            onStatus: (status) => {
              setStreamingState((s) => ({ ...s, status }));
            },
            onHandoff: (handoffText, expertNames) => {
              handoffTextRef.current = handoffText;
              delegatedExpertsRef.current = expertNames;
              setStreamingState((s) => ({ ...s, handoffText }));
            },
            onExpertActive: (expertName) => {
              setStreamingState((s) => ({ ...s, expertLabel: expertName }));
            },
            onToken: (delta) => {
              streamBufferRef.current += delta;
              const nextBuf = streamBufferRef.current;
              setStreamingState((s) => ({ ...s, buffer: nextBuf }));
            },
            onParseWarn: (raw) => {
              addDebugEntry({
                type: 'parse_warn',
                summary: 'Jennifer planner returned prose instead of XML; degraded safely.',
                details: raw.slice(0, 400),
              });
            },
          },
        });

        const jenniferMsg: ChatMessage = {
          id: generateId(),
          chatId: activeChat.id,
          role: 'jennifer',
          content: result.content || streamBufferRef.current || 'Done.',
          handoffText: result.handoffText,
          delegatedExperts: result.delegatedExperts,
          timestamp: nowIso(),
          status: 'complete',
          savedToLibrary: false,
          turnId,
        };

        await saveMessage(jenniferMsg);
        setMessages((curr) => [...curr, jenniferMsg]);
        const updatedChat = {
          ...activeChat,
          sessionFacts: result.updatedFacts,
          updatedAt: nowIso(),
        };
        setActiveChat(updatedChat);
        await updateChat(updatedChat);

        addDebugEntry({
          type: 'turn',
          summary:
            result.delegatedExperts.length > 0
              ? `Delegated to ${result.delegatedExperts.join(', ')}${
                  result.truncatedDelegates ? ` (+${result.truncatedDelegates} capped)` : ''
                }`
              : 'Direct Jennifer reply',
          callCount: result.callCount,
          durationMs: result.durationMs,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          const partial = streamBufferRef.current.trim();
          if (partial) {
            const stoppedMsg: ChatMessage = {
              id: generateId(),
              chatId: activeChat.id,
              role: 'jennifer',
              content: partial,
              handoffText: handoffTextRef.current ?? undefined,
              delegatedExperts: delegatedExpertsRef.current,
              timestamp: nowIso(),
              status: 'stopped',
              savedToLibrary: false,
              turnId,
            };
            await saveMessage(stoppedMsg);
            setMessages((curr) => [...curr, stoppedMsg]);
          }
          pushToast('Stopped. You can edit your message and try again.', 'info');
        } else {
          const aiErr =
            err instanceof AIError
              ? err
              : new AIError({
                  code: 'UNKNOWN',
                  message: err instanceof Error ? err.message : 'Unexpected error',
                  provider: activeSettings.provider,
                  raw: err,
                });

          const errMsg: ChatMessage = {
            id: generateId(),
            chatId: activeChat.id,
            role: 'jennifer',
            content: aiErr.message,
            timestamp: nowIso(),
            status: 'error',
            turnId,
            errorData: {
              code: aiErr.code,
              provider: aiErr.provider,
              status: aiErr.status,
              retryAfterMs: aiErr.retryAfterMs,
              modelId: activeSettings.model,
              lastUserMessage: trimmed,
            },
          };
          await saveMessage(errMsg);
          setMessages((curr) => [...curr, errMsg]);
          addDebugEntry({
            type: 'error',
            summary: `${aiErr.code}: ${aiErr.message}`,
            details: aiErr,
          });
        }
      } finally {
        abortRef.current = null;
        setStreamingState({
          active: false,
          status: null,
          handoffText: null,
          expertLabel: null,
          buffer: '',
        });
      }
    },
    [
      activeChat,
      addDebugEntry,
      experts,
      guardrails,
      messages,
      pushToast,
      referencePhoto,
      settings,
      streamingState.active,
    ]
  );

  const handleSend = useCallback(() => {
    const text = draft;
    if (!text.trim() || !isConfigured || streamingState.active) return;
    setDraft('');
    executeTurn(text);
  }, [draft, executeTurn, isConfigured, streamingState.active]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort('user_stop');
  }, []);

  // Desktop keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (streamingState.active) {
          handleStop();
        } else if (activePanel) {
          setActivePanel(null);
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        composerInputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setActivePanel((p) => (p === 'library' ? null : 'library'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel, handleStop, mobileMenuOpen, streamingState.active]);

  const handleSaveToLibrary = useCallback(
    async (
      msg: ChatMessage,
      payload: { title: string; type: LibraryItemType; tags: string[] }
    ) => {
      const item: LibraryItem = {
        id: generateId(),
        title: payload.title,
        content: msg.content,
        type: payload.type,
        tags: payload.tags,
        sourceChatId: msg.chatId,
        sourceMessageId: msg.id,
        createdAt: nowIso(),
      };
      await saveLibraryItem(item);
      setLibrary((prev) => [item, ...prev]);

      const updatedMsg: ChatMessage = { ...msg, savedToLibrary: true };
      await saveMessage(updatedMsg);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? updatedMsg : m)));
      pushToast('Saved to Content Library.', 'success');
    },
    [pushToast]
  );

  const handleNewChat = useCallback(async () => {
    if (!activeChat) return;
    await clearChatMessages(activeChat.id);
    const fresh = await createNewChat();
    setActiveChat(fresh);
    setMessages([]);
    setReferencePhoto('');
    setNewChatModalOpen(false);
    pushToast('Started a fresh session.', 'info');
  }, [activeChat, pushToast]);

  const handleErrorAction = useCallback(
    async (
      action: 'open_settings' | 'retry' | 'try_alt_model' | 'new_chat',
      msg: ChatMessage,
      altModel?: string
    ) => {
      if (action === 'open_settings') {
        setActivePanel('settings');
        return;
      }
      if (action === 'new_chat') {
        await handleNewChat();
        return;
      }
      const promptToRetry = msg.errorData?.lastUserMessage;
      if (!promptToRetry) return;

      if (action === 'try_alt_model' && altModel) {
        const nextSettings = { ...settings, model: altModel };
        await handleUpdateSettings({ model: altModel });
        await executeTurn(promptToRetry, nextSettings);
        return;
      }
      if (action === 'retry') {
        await executeTurn(promptToRetry);
      }
    },
    [executeTurn, handleNewChat, handleUpdateSettings, settings]
  );

  const handleCopyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        pushToast('Copied to clipboard.', 'success');
      } catch {
        pushToast('Could not access clipboard.', 'danger');
      }
    },
    [pushToast]
  );

  const panelTitles: Record<Exclude<ActivePanel, null>, string> = {
    settings: 'Settings',
    library: `Content Library (${library.length})`,
    experts: 'Specialist Experts',
    guardrails: 'Brand DNA Guardrails',
  };

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)] text-sm">
        Opening Hedetangen AI Studio…
      </div>
    );
  }

  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Top Bar — 3-zone single-row contract */}
      <header className="sticky top-0 z-30 shrink-0 h-14 pt-[env(safe-area-inset-top)] bg-[var(--surface)] border-b border-[var(--border)] px-3 sm:px-6 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="md:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-lg text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold tracking-tight text-[var(--text)] whitespace-nowrap shrink-0">
            Hedetangen
          </span>
        </div>

        {/* Zone 2: Clean single-line text links (desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() =>
              messages.length > 0 ? setNewChatModalOpen(true) : composerInputRef.current?.focus()
            }
            className="hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'guardrails' ? null : 'guardrails'))}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'guardrails' ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Brand DNA
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'experts' ? null : 'experts'))}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'experts' ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Experts
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'library' ? null : 'library'))}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'library' ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Library
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'library' ? null : 'library'))}
            className="md:hidden min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] whitespace-nowrap shrink-0"
          >
            Library
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'settings' ? null : 'settings'))}
            className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Workspace: Chat column + Collapsible / Pinnable Right Rail */}
      <div className="flex-1 min-h-0 flex relative">
        <main className="flex-1 min-w-0 flex flex-col">
          <ChatList
            messages={messages}
            loading={loadingChat}
            isConfigured={isConfigured}
            streamingState={streamingState}
            altModelId={altModelId}
            onSelectSuggestion={(text) => {
              setDraft(text);
              composerInputRef.current?.focus();
            }}
            onOpenSettings={() => setActivePanel('settings')}
            onEnableDemoMode={handleEnableDemoMode}
            onSaveToLibrary={handleSaveToLibrary}
            onErrorAction={handleErrorAction}
            onCopy={handleCopyText}
          />

          {wizardOpen ? (
            <Wizard
              guardrails={guardrails}
              defaultLanguage={settings.language}
              onCancel={() => setWizardOpen(false)}
              onGenerate={(prompt) => {
                setWizardOpen(false);
                if (!isConfigured) {
                  setDraft(prompt);
                  pushToast('Add an API key or enable Demo Mode to send this brief.', 'info');
                  return;
                }
                executeTurn(prompt);
              }}
            />
          ) : (
            <Composer
              draft={draft}
              onDraftChange={setDraft}
              referencePhoto={referencePhoto}
              onReferencePhotoChange={setReferencePhoto}
              onSend={handleSend}
              onStop={handleStop}
              onOpenWizard={() => setWizardOpen(true)}
              onOpenSettings={() => setActivePanel('settings')}
              onEnableDemoMode={handleEnableDemoMode}
              isStreaming={streamingState.active}
              isConfigured={isConfigured}
              inputRef={composerInputRef}
            />
          )}
        </main>

        {/* Drawer / Right Rail */}
        {activePanel && (
          <aside
            aria-label={panelTitles[activePanel]}
            className="fixed inset-0 z-40 md:static md:inset-auto md:z-20 md:w-[380px] xl:w-[400px] shrink-0 bg-[var(--surface)] md:border-l border-[var(--border)] flex flex-col shadow-[var(--shadow-drawer)] md:shadow-none"
          >
            <div className="h-14 px-4 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
              <h2 className="text-sm font-semibold text-[var(--text)] truncate">
                {panelTitles[activePanel]}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = !railPinned;
                    setRailPinned(next);
                    localStorage.setItem(LS_KEYS.RAIL_PINNED, String(next));
                  }}
                  title={railPinned ? 'Unpin panel' : 'Pin panel on desktop'}
                  aria-label={railPinned ? 'Unpin panel' : 'Pin panel'}
                  className="hidden xl:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                >
                  {railPinned ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  aria-label="Close panel"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activePanel === 'settings' && (
                <SettingsPanel
                  settings={settings}
                  models={models}
                  modelsFetchedAt={modelsFetchedAt}
                  onUpdateSettings={handleUpdateSettings}
                  onValidateAndLoadModels={handleValidateAndLoadModels}
                  onRefreshModels={handleRefreshModels}
                  onOpenExperts={() => setActivePanel('experts')}
                  onOpenGuardrails={() => setActivePanel('guardrails')}
                  onOpenImportExport={() => setImportExportOpen(true)}
                  onClearAllData={async () => {
                    await clearAllStudioData();
                    await saveApiKey('groq', '', false);
                    setActivePanel(null);
                    await bootstrapStudio();
                    pushToast('All studio data cleared.', 'info');
                  }}
                  onUnlockDebug={() => {
                    setDebugOpen(true);
                    pushToast('Diagnostics enabled.', 'info');
                  }}
                />
              )}

              {activePanel === 'library' && (
                <LibraryPanel
                  items={library}
                  onDeleteItem={async (id) => {
                    await deleteLibraryItem(id);
                    setLibrary((prev) => prev.filter((it) => it.id !== id));
                    pushToast('Removed from library.', 'info');
                  }}
                  onBulkDelete={async (ids) => {
                    for (const id of ids) {
                      await deleteLibraryItem(id);
                    }
                    setLibrary((prev) => prev.filter((it) => !ids.includes(it.id)));
                    pushToast(`Deleted ${ids.length} item(s).`, 'info');
                  }}
                  onCopy={handleCopyText}
                  onNotify={pushToast}
                />
              )}

              {activePanel === 'experts' && (
                <ExpertEditor
                  experts={experts}
                  onSaveExpert={async (exp) => {
                    await saveExpert(exp);
                    const res = await loadExperts();
                    setExperts(res.experts);
                  }}
                  onDeleteExpert={async (id) => {
                    await removeExpert(id);
                    const res = await loadExperts();
                    setExperts(res.experts);
                  }}
                  onImportExperts={async (incoming) => {
                    for (const exp of incoming) {
                      await saveExpert(exp);
                    }
                    const res = await loadExperts();
                    setExperts(res.experts);
                  }}
                  onNotify={pushToast}
                />
              )}

              {activePanel === 'guardrails' && (
                <GuardrailsEditor
                  guardrails={guardrails}
                  onSaveGuardrails={async (next) => {
                    const saved = await saveGuardrails(next);
                    setGuardrails(saved);
                  }}
                  onNotify={pushToast}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile Navigation Sheet */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/45 flex flex-col justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="bg-[var(--surface)] border-t border-[var(--border)] rounded-t-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-sm font-semibold">Hedetangen Studio</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (messages.length > 0) setNewChatModalOpen(true);
              }}
              className="w-full min-h-[48px] px-3 text-left text-sm font-medium rounded-lg hover:bg-[var(--surface-muted)]"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('guardrails');
              }}
              className="w-full min-h-[48px] px-3 text-left text-sm font-medium rounded-lg hover:bg-[var(--surface-muted)]"
            >
              Brand DNA Guardrails
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('experts');
              }}
              className="w-full min-h-[48px] px-3 text-left text-sm font-medium rounded-lg hover:bg-[var(--surface-muted)]"
            >
              Specialist Experts
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('library');
              }}
              className="w-full min-h-[48px] px-3 text-left text-sm font-medium rounded-lg hover:bg-[var(--surface-muted)]"
            >
              Content Library ({library.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('settings');
              }}
              className="w-full min-h-[48px] px-3 text-left text-sm font-medium rounded-lg hover:bg-[var(--surface-muted)]"
            >
              Settings
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={newChatModalOpen}
        title="Start a new chat?"
        description="This clears the current conversation messages from view. Anything you saved to the Content Library remains stored."
        confirmLabel="Start new chat"
        onConfirm={handleNewChat}
        onCancel={() => setNewChatModalOpen(false)}
      />

      <ImportExportModal
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        onImportComplete={bootstrapStudio}
        onNotify={pushToast}
      />

      <DebugDrawer
        open={debugOpen}
        entries={debugEntries}
        onClose={() => setDebugOpen(false)}
        onClear={() => setDebugEntries([])}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
