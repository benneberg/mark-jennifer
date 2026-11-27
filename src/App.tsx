import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Moon, PanelRightClose, PanelRightOpen, Sun, X } from 'lucide-react';
import { ChatsPanel } from './components/ChatsPanel';
import { ChatList } from './components/ChatList';
import { Composer } from './components/Composer';
import { DebugDrawer } from './components/DebugDrawer';
import { ExpertEditor } from './components/ExpertEditor';
import { EyeEmblem, useGlobalEyeTracker } from './components/EyeEmblem';
import { GuardrailsEditor } from './components/GuardrailsEditor';
import { ImportExportModal } from './components/ImportExportModal';
import { LibraryPanel } from './components/LibraryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastContainer } from './components/ToastContainer';
import { Wizard } from './components/Wizard';
import { LS_KEYS } from './constants';
import { MODEL_METADATA } from './data/model-metadata';
import { createSeedGuardrails } from './data/seed-guardrails';
import { runJenniferTurn } from './orchestration/jennifer';
import { createProvider, fetchAndCacheModels } from './providers';
import { AIError } from './providers/errors';
import { hasApiKey } from './storage/crypto';
import {
  clearAllStudioData,
  createNewChat,
  DEFAULT_SETTINGS,
  deleteChat,
  deleteLibraryItem,
  deleteMessage,
  clearTurnInFlight,
  ensureSeedData,
  getOrCreateActiveChat,
  loadAllChats,
  loadExperts,
  loadGuardrails,
  loadLibrary,
  loadMessagesForChat,
  loadSettings,
  markTurnInFlight,
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
import { safeGetItem, safeSetItem } from './utils/safe-storage';

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsFetchedAt, setModelsFetchedAt] = useState<string | null>(null);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrails>(() => createSeedGuardrails());
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [referencePhoto, setReferencePhoto] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [railPinned, setRailPinned] = useState<boolean>(
    () => safeGetItem(LS_KEYS.RAIL_PINNED) === 'true'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
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

  const isGeneratingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef('');
  const handoffTextRef = useRef<string | null>(null);
  const delegatedExpertsRef = useRef<string[]>([]);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  useGlobalEyeTracker('studioEyeBadge');

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

  // Sync theme to <html> and mobile theme-color meta
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.getElementById('themeColor');
    if (metaTheme) {
      metaTheme.setAttribute('content', settings.theme === 'dark' ? '#111110' : '#F4EFE4');
    }
  }, [settings.theme]);

  const bootstrapStudio = useCallback(async () => {
    setLoadingChat(true);
    setBootError(null);
    try {
      const { skippedCount } = await ensureSeedData();
      const [loadedSettings, expRes, loadedGuardrails, libRes, chat, allChats] = await Promise.all([
        loadSettings(),
        loadExperts(),
        loadGuardrails(),
        loadLibrary(),
        getOrCreateActiveChat(),
        loadAllChats(),
      ]);

      const msgs = await loadMessagesForChat(chat.id);
      const keyPresent = await hasApiKey(loadedSettings.provider);

      setSettings(loadedSettings);
      setExperts(expRes.experts);
      setGuardrails(loadedGuardrails);
      setLibrary(libRes.items);
      setChats(allChats.length > 0 ? allChats : [chat]);
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
    } catch (err) {
      setBootError(
        err instanceof Error
          ? err.message
          : 'Local storage is unavailable in this browser context.'
      );
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

  const handleToggleTheme = useCallback(() => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    handleUpdateSettings({ theme: nextTheme });
  }, [handleUpdateSettings, settings.theme]);

  const handleEnableDemoMode = useCallback(async () => {
    await handleUpdateSettings({
      provider: 'mock',
      model: 'hedetangen-demo-v1',
    });
    const demoModels = await fetchAndCacheModels('mock');
    setModels(demoModels.models);
    setModelsFetchedAt(demoModels.fetchedAt);
    setHasKey(true);
    safeSetItem(LS_KEYS.ONBOARDED, 'true');
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
      safeSetItem(LS_KEYS.ONBOARDED, 'true');
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
    const preferredOrder = Object.keys(MODEL_METADATA[settings.provider] ?? {});
    const candidates = models.filter(
      (m) =>
        m.id !== settings.model &&
        (settings.provider === 'openai' || m.free) &&
        !m.id.toLowerCase().includes('allam')
    );
    const curated = preferredOrder.find((id) => candidates.some((c) => c.id === id));
    return curated ?? candidates[0]?.id;
  }, [models, settings.model, settings.provider]);

  const persistChat = useCallback(
    async (chat: Chat) => {
      try {
        await updateChat(chat);
      } catch (err) {
        pushToast(
          `Conversation could not be saved: ${
            err instanceof Error ? err.message : 'validation error'
          }`,
          'danger'
        );
      }
    },
    [pushToast]
  );

  const executeTurn = useCallback(
    async (userText: string, overrideSettings?: AppSettings, retryErrorMsgId?: string) => {
      const trimmed = userText.trim();
      if (!trimmed || !activeChat || isGeneratingRef.current || streamingState.active) return;

      isGeneratingRef.current = true;
      const activeSettings = overrideSettings ?? settings;
      const turnId = generateId();
      let currentChat: Chat = activeChat;

      let baseMessages = messages;
      if (retryErrorMsgId) {
        await deleteMessage(retryErrorMsgId);
        baseMessages = messages.filter((m) => m.id !== retryErrorMsgId);
      }

      const lastMsg = baseMessages[baseMessages.length - 1];
      const reuseExistingUserMsg =
        Boolean(retryErrorMsgId) &&
        lastMsg?.role === 'user' &&
        lastMsg.content.trim() === trimmed;

      const prevHistory = reuseExistingUserMsg ? baseMessages.slice(0, -1) : baseMessages;
      if (reuseExistingUserMsg) {
        setMessages(baseMessages);
      } else {
        const userMsg: ChatMessage = {
          id: generateId(),
          chatId: currentChat.id,
          role: 'user',
          content: trimmed,
          timestamp: nowIso(),
          status: 'complete',
          turnId,
        };
        const updatedMessages = [...baseMessages, userMsg];
        setMessages(updatedMessages);
        await saveMessage(userMsg);
      }

      if (prevHistory.filter((m) => m.role === 'user').length === 0) {
        const nextTitle = trimmed.slice(0, 60);
        currentChat = { ...currentChat, title: nextTitle, updatedAt: nowIso() };
        setActiveChat(currentChat);
        setChats((prev) => [currentChat, ...prev.filter((c) => c.id !== currentChat.id)]);
        await persistChat(currentChat);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      streamBufferRef.current = '';
      handoffTextRef.current = null;
      delegatedExpertsRef.current = [];

      const assistantMsgId = generateId();
      const assistantTs = nowIso();
      let lastDbPersistAt = 0;
      let lastPersistedLength = 0;
      let hasPersistedStreaming = false;

      setStreamingState({
        active: true,
        status: 'Jennifer is thinking…',
        handoffText: null,
        expertLabel: null,
        buffer: '',
      });

      try {
        // Crash recovery marker: best-effort, must never fail the turn itself.
        await markTurnInFlight({
          messageId: assistantMsgId,
          chatId: currentChat.id,
          startedAt: assistantTs,
        }).catch(() => {});
        const result = await runJenniferTurn({
          userMessage: trimmed,
          history: prevHistory,
          sessionFacts: currentChat.sessionFacts,
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

              // Checkpointing the whole response on every tick was O(n^2) writes on
              // mobile storage; require real progress before persisting again.
              const nowMs = Date.now();
              const grewEnough = nextBuf.length - lastPersistedLength >= 400;
              if (nextBuf.trim() && grewEnough && nowMs - lastDbPersistAt >= 1200) {
                lastDbPersistAt = nowMs;
                lastPersistedLength = nextBuf.length;
                hasPersistedStreaming = true;
                saveMessage({
                  id: assistantMsgId,
                  chatId: currentChat.id,
                  role: 'jennifer',
                  content: nextBuf,
                  handoffText: handoffTextRef.current ?? undefined,
                  delegatedExperts: delegatedExpertsRef.current,
                  timestamp: assistantTs,
                  status: 'streaming',
                  savedToLibrary: false,
                  turnId,
                }).catch(() => {});
              }
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

        const finalText = (result.content || streamBufferRef.current).trim() || 'Done.';
        const jenniferMsg: ChatMessage = {
          id: assistantMsgId,
          chatId: currentChat.id,
          role: 'jennifer',
          content: finalText,
          handoffText: result.handoffText,
          delegatedExperts: result.delegatedExperts,
          timestamp: assistantTs,
          status: 'complete',
          savedToLibrary: false,
          turnId,
        };

        await saveMessage(jenniferMsg);
        setMessages((curr) => [...curr.filter((m) => m.id !== assistantMsgId), jenniferMsg]);
        const updatedChat: Chat = {
          ...currentChat,
          sessionFacts: result.updatedFacts,
          updatedAt: nowIso(),
        };
        setActiveChat(updatedChat);
        setChats((prev) => [updatedChat, ...prev.filter((c) => c.id !== updatedChat.id)]);
        await persistChat(updatedChat);

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
        const isAborted =
          controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
        const errPartial = err instanceof AIError ? err.partialContent ?? '' : '';
        const partial = (streamBufferRef.current || errPartial).trim();

        if (partial) {
          const stoppedMsg: ChatMessage = {
            id: assistantMsgId,
            chatId: currentChat.id,
            role: 'jennifer',
            content: partial,
            handoffText: handoffTextRef.current ?? undefined,
            delegatedExperts: delegatedExpertsRef.current,
            timestamp: assistantTs,
            status: 'stopped',
            savedToLibrary: false,
            turnId,
          };
          await saveMessage(stoppedMsg);
          setMessages((curr) => [...curr.filter((m) => m.id !== assistantMsgId), stoppedMsg]);
        } else if (hasPersistedStreaming) {
          await deleteMessage(assistantMsgId).catch(() => {});
        }

        if (isAborted) {
          pushToast(
            partial ? 'Stopped. Partial response saved.' : 'Stopped.',
            'info'
          );
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
            chatId: currentChat.id,
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
        await clearTurnInFlight().catch(() => {});
        isGeneratingRef.current = false;
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
      persistChat,
      pushToast,
      referencePhoto,
      settings,
      streamingState.active,
    ]
  );

  const handleSend = useCallback(() => {
    const text = draft;
    if (!text.trim() || !isConfigured || isGeneratingRef.current || streamingState.active) return;
    setDraft('');
    executeTurn(text);
  }, [draft, executeTurn, isConfigured, streamingState.active]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
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

      try {
        await saveLibraryItem(item);
        setLibrary((prev) => [item, ...prev]);

        const updatedMsg: ChatMessage = { ...msg, savedToLibrary: true };
        await saveMessage(updatedMsg);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? updatedMsg : m)));
        pushToast('Saved to Content Library.', 'success');
      } catch (err) {
        pushToast(
          `Could not save to library: ${err instanceof Error ? err.message : 'unknown error'}`,
          'danger'
        );
      }
    },
    [pushToast]
  );

  const handleNewChat = useCallback(async () => {
    if (isGeneratingRef.current || streamingState.active) return;
    if (activeChat && messages.length === 0) {
      setActivePanel(null);
      composerInputRef.current?.focus();
      return;
    }
    const fresh = await createNewChat();
    setChats((prev) => [fresh, ...prev]);
    setActiveChat(fresh);
    setMessages([]);
    setReferencePhoto('');
    setActivePanel(null);
    composerInputRef.current?.focus();
    pushToast('Started a new chat. Previous chats remain saved under Chats.', 'info');
  }, [activeChat, messages.length, pushToast, streamingState.active]);

  const handleSelectChat = useCallback(
    async (chatId: string) => {
      if (isGeneratingRef.current || streamingState.active) return;
      const target = chats.find((c) => c.id === chatId);
      if (!target) return;
      const loadedMsgs = await loadMessagesForChat(chatId);
      setActiveChat(target);
      setMessages(loadedMsgs);
      setReferencePhoto(target.sessionFacts?.referencePhoto ?? '');
      if (window.innerWidth < 768) {
        setActivePanel(null);
      }
    },
    [chats, streamingState.active]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      if (isGeneratingRef.current || streamingState.active) return;
      await deleteChat(chatId);
      const remaining = chats.filter((c) => c.id !== chatId);
      if (activeChat?.id === chatId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          const nextMsgs = await loadMessagesForChat(next.id);
          setChats(remaining);
          setActiveChat(next);
          setMessages(nextMsgs);
          setReferencePhoto(next.sessionFacts?.referencePhoto ?? '');
        } else {
          const fresh = await createNewChat();
          setChats([fresh]);
          setActiveChat(fresh);
          setMessages([]);
          setReferencePhoto('');
        }
      } else {
        setChats(remaining);
      }
      pushToast('Chat deleted.', 'info');
    },
    [activeChat?.id, chats, pushToast, streamingState.active]
  );

  const handleContinueMessage = useCallback(
    (msg: ChatMessage) => {
      if (!isConfigured || isGeneratingRef.current || streamingState.active) return;
      void msg;
      executeTurn(
        'Please continue from exactly where your previous message left off without repeating what you already wrote.'
      );
    },
    [executeTurn, isConfigured, streamingState.active]
  );

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
        await executeTurn(promptToRetry, nextSettings, msg.id);
        return;
      }
      if (action === 'retry') {
        await executeTurn(promptToRetry, undefined, msg.id);
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
    chats: `Chats (${chats.length})`,
    settings: 'Settings',
    library: `Content Library (${library.length})`,
    experts: 'Specialist Experts',
    guardrails: 'Brand DNA Guardrails',
  };

  if (bootError) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-[var(--text)]">
        <div className="max-w-md w-full space-y-3 p-6 rounded-[24px] glass-surface border border-[var(--border)]">
          <EyeEmblem size="lg" />
          <h1 className="text-lg font-semibold">The studio could not open its local database</h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            {bootError}
          </p>
          <p className="text-xs text-[var(--text-faint)] leading-relaxed">
            Private browsing, blocked storage, or a full disk can cause this. Nothing has been
            deleted — reopen the app in a normal window, then export a backup from Settings.
          </p>
          <button
            type="button"
            onClick={() => {
              void bootstrapStudio();
            }}
            className="min-h-[42px] px-4 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] text-[#181817]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="relative z-[1] min-h-dvh flex flex-col items-center justify-center gap-3 text-[var(--text-muted)] text-sm">
        <EyeEmblem size="lg" />
        <span>Opening Hedetangen Studio…</span>
      </div>
    );
  }

  return (
    <div className="relative z-[1] min-h-dvh h-dvh flex flex-col text-[var(--text)] overflow-hidden">
      {/* Top Bar — glassmorphic bar with interactive top-left Eye Emblem */}
      <header className="sticky top-0 z-30 shrink-0 h-16 pt-[env(safe-area-inset-top)] glass-surface border-b border-[var(--border)] px-3 sm:px-6 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Interactive Eye Emblem + Brand Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="md:hidden min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-full text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePanel(null);
              composerInputRef.current?.focus();
            }}
            className="flex items-center gap-2.5 min-w-0 text-left rounded-full pr-1 focus-visible:outline-none"
            title="Return to chat"
          >
            <EyeEmblem size="sm" badgeId="studioEyeBadge" />
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text)] whitespace-nowrap shrink-0">
              Hedetangen
            </span>
          </button>
        </div>

        {/* Zone 2: Clean single-line text links (desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-muted)]">
          <button
            type="button"
            onClick={handleNewChat}
            className="hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'chats' ? null : 'chats'))}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'chats' ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Chats
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

        {/* Zone 3: Theme quick toggle + Settings */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="w-10 h-10 rounded-full glass-surface border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-center text-[var(--text)] transition-transform hover:scale-[1.04] active:scale-[0.96]"
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px]" />
            ) : (
              <Moon className="w-[18px] h-[18px]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'library' ? null : 'library'))}
            className="md:hidden min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text)] whitespace-nowrap shrink-0"
          >
            Library
          </button>

          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'settings' ? null : 'settings'))}
            className={`min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap shrink-0 ${
              activePanel === 'settings'
                ? 'bg-[var(--obsidian)] text-[#F4EFE4] dark:bg-[var(--sand)] dark:text-[#181817]'
                : 'bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)]'
            }`}
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
            onContinue={handleContinueMessage}
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
            className="fixed inset-0 z-40 md:static md:inset-auto md:z-20 md:w-[390px] xl:w-[420px] shrink-0 bg-[var(--bg)] md:bg-[var(--surface)] md:backdrop-blur-xl md:border-l border-[var(--border)] flex flex-col shadow-[var(--shadow-drawer)] md:shadow-none"
          >
            <div className="h-16 px-5 glass-surface md:bg-transparent border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
              <h2 className="text-lg font-light tracking-[-0.015em] text-[var(--text)] truncate">
                {panelTitles[activePanel]}
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = !railPinned;
                    setRailPinned(next);
                    safeSetItem(LS_KEYS.RAIL_PINNED, String(next));
                  }}
                  title={railPinned ? 'Unpin panel' : 'Pin panel on desktop'}
                  aria-label={railPinned ? 'Unpin panel' : 'Pin panel'}
                  className="hidden xl:flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
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
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activePanel === 'chats' && (
                <ChatsPanel
                  chats={chats}
                  activeChatId={activeChat?.id ?? null}
                  disabled={streamingState.active}
                  onSelectChat={handleSelectChat}
                  onNewChat={handleNewChat}
                  onDeleteChat={handleDeleteChat}
                />
              )}

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
          className="fixed inset-0 z-50 md:hidden bg-[rgba(24,24,23,0.5)] backdrop-blur-[4px] flex flex-col justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="bg-[var(--bg)] border-t border-[var(--border)] rounded-t-[32px] px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-2 shadow-[var(--shadow-md)]">
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-2" />
            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <EyeEmblem size="sm" />
                <span className="text-sm font-semibold">Hedetangen Studio</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleNewChat();
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('chats');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Chats ({chats.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('guardrails');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Brand DNA Guardrails
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('experts');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Specialist Experts
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('library');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Content Library ({library.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActivePanel('settings');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
      )}

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
