import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Moon, PanelRightClose, PanelRightOpen, Sun, X } from 'lucide-react';
import {
  generateCampaignPackage,
  generateSingleDeliverableModule,
} from './campaign/engine';
import { buildWinterBookingsPreset } from './campaign/presets';
import { BusinessProfileEditor } from './components/BusinessProfileEditor';
import { ChatsPanel } from './components/ChatsPanel';
import { ChatList } from './components/ChatList';
import { Composer } from './components/Composer';
import { DebugDrawer } from './components/DebugDrawer';
import { ExpertEditor } from './components/ExpertEditor';
import { EyeEmblem, useGlobalEyeTracker } from './components/EyeEmblem';
import { GuardrailsEditor } from './components/GuardrailsEditor';
import { ImportExportModal } from './components/ImportExportModal';
import { LibraryPanel } from './components/LibraryPanel';
import { ModulesView } from './components/ModulesView';
import { PackageView } from './components/PackageView';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastContainer } from './components/ToastContainer';
import { Wizard } from './components/Wizard';
import { LS_KEYS } from './constants';
import { MODEL_METADATA } from './data/model-metadata';
import { createSeedGuardrails } from './data/seed-guardrails';
import { runJenniferTurn } from './orchestration/jennifer';
import { createProvider, fetchAndCacheModels } from './providers';
import { AIError } from './providers/errors';
import { hasApiKey, saveApiKey } from './storage/crypto';
import {
  clearAllStudioData,
  createNewChat,
  DEFAULT_SETTINGS,
  deleteChat,
  deleteLibraryItem,
  deleteMessage,
  deletePackage,
  ensureSeedData,
  getDefaultBusinessProfile,
  getOrCreateActiveChat,
  loadAllChats,
  loadBusinessProfile,
  loadExperts,
  loadGuardrails,
  loadLibrary,
  loadMessagesForChat,
  loadPackages,
  loadSettings,
  removeExpert,
  resetBusinessProfile,
  saveBusinessProfile,
  saveExpert,
  saveGuardrails,
  saveLibraryItem,
  saveMessage,
  savePackage,
  saveSettings,
  updateChat,
} from './storage/entities';
import type {
  ActivePanel,
  AppSettings,
  BusinessProfile,
  CampaignDeliverable,
  CampaignIntake,
  CampaignPackage,
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
  WorkspaceView,
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
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() =>
    getDefaultBusinessProfile()
  );
  const [packages, setPackages] = useState<CampaignPackage[]>([]);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('chat');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
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
  const [wizardDraft, setWizardDraft] = useState<Partial<CampaignIntake> | null>(null);
  const [pkgGenerating, setPkgGenerating] = useState(false);
  const [pkgProgressLabel, setPkgProgressLabel] = useState<string | null>(null);
  const [regeneratingDeliverableId, setRegeneratingDeliverableId] = useState<string | null>(null);
  const pkgAbortRef = useRef<AbortController | null>(null);
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
    try {
      const { skippedCount } = await ensureSeedData();
      const [
        loadedSettings,
        expRes,
        loadedGuardrails,
        loadedProfile,
        loadedPackages,
        libRes,
        chat,
        allChats,
      ] = await Promise.all([
        loadSettings(),
        loadExperts(),
        loadGuardrails(),
        loadBusinessProfile(),
        loadPackages(),
        loadLibrary(),
        getOrCreateActiveChat(),
        loadAllChats(),
      ]);

      const msgs = await loadMessagesForChat(chat.id);
      const keyPresent = await hasApiKey(loadedSettings.provider);

      setSettings(loadedSettings);
      setExperts(expRes.experts);
      setGuardrails(loadedGuardrails);
      setBusinessProfile(loadedProfile);
      setPackages(loadedPackages);
      setActivePackageId((curr) => curr ?? loadedPackages[0]?.id ?? null);
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

  const openWinterBookingsWizard = useCallback(() => {
    setWizardDraft(buildWinterBookingsPreset(businessProfile, settings.language));
    setWizardOpen(true);
  }, [businessProfile, settings.language]);

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
        await updateChat(currentChat);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      streamBufferRef.current = '';
      handoffTextRef.current = null;
      delegatedExpertsRef.current = [];

      const assistantMsgId = generateId();
      const assistantTs = nowIso();
      let lastDbPersistAt = 0;
      let hasPersistedStreaming = false;

      setStreamingState({
        active: true,
        status: 'Jennifer is thinking…',
        handoffText: null,
        expertLabel: null,
        buffer: '',
      });

      try {
        const activePkgForChat =
          packages.find((p) => p.id === activePackageId) ?? packages[0] ?? null;

        const result = await runJenniferTurn({
          userMessage: trimmed,
          history: prevHistory,
          sessionFacts: currentChat.sessionFacts,
          referencePhoto: referencePhoto.trim(),
          settings: activeSettings,
          guardrails,
          experts,
          businessProfile,
          activePackage: activePkgForChat,
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

              const nowMs = Date.now();
              if (nextBuf.trim() && nowMs - lastDbPersistAt >= 650) {
                lastDbPersistAt = nowMs;
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
      activePackageId,
      addDebugEntry,
      businessProfile,
      experts,
      guardrails,
      messages,
      packages,
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

  const handleGeneratePackage = useCallback(
    async (intake: CampaignIntake) => {
      if (!isConfigured) {
        pushToast('Add an API key or enable Demo Mode in Settings first.', 'info');
        setActivePanel('settings');
        return;
      }
      if (pkgGenerating) return;

      const controller = new AbortController();
      pkgAbortRef.current = controller;
      setPkgGenerating(true);
      setPkgProgressLabel('Starting Campaign Package Engine…');

      try {
        const pkg = await generateCampaignPackage({
          intake,
          settings,
          guardrails,
          businessProfile,
          sourceChatId: activeChat?.id,
          signal: controller.signal,
          onProgress: (label, cur, total) => {
            setPkgProgressLabel(`Step ${cur}/${total}: ${label}`);
          },
        });

        await savePackage(pkg);
        setPackages((prev) => [pkg, ...prev]);
        setActivePackageId(pkg.id);
        setWizardOpen(false);
        setWizardDraft(null);
        setWorkspaceView('campaigns');
        pushToast('Campaign Package built & verified.', 'success');
      } catch (err) {
        const aborted =
          controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
        if (aborted) {
          pushToast('Campaign package build stopped.', 'info');
        } else {
          pushToast(
            err instanceof Error ? err.message : 'Failed to build campaign package.',
            'danger'
          );
        }
      } finally {
        setPkgGenerating(false);
        setPkgProgressLabel(null);
        pkgAbortRef.current = null;
      }
    },
    [activeChat?.id, businessProfile, guardrails, isConfigured, pkgGenerating, pushToast, settings]
  );

  const handleRegenerateDeliverable = useCallback(
    async (
      pkg: CampaignPackage,
      deliverable: CampaignDeliverable,
      instruction: string
    ) => {
      if (!isConfigured) {
        pushToast('Add an API key or enable Demo Mode in Settings first.', 'info');
        setActivePanel('settings');
        return;
      }
      if (regeneratingDeliverableId) return;

      const controller = new AbortController();
      setRegeneratingDeliverableId(deliverable.id);

      try {
        const extraContext = [
          `Campaign Strategy Headline: ${pkg.strategy.headline}`,
          `Positioning: ${pkg.strategy.positioning}`,
          `Previous version to improve:\n${deliverable.markdown}`,
          instruction
            ? `Owner revision request: ${instruction}`
            : 'Refresh and sharpen this deliverable while keeping all brand and honesty rules.',
        ].join('\n\n');

        const regenerated = await generateSingleDeliverableModule({
          kind: deliverable.kind,
          intake: pkg.intake,
          settings,
          guardrails,
          businessProfile,
          extraContext,
          signal: controller.signal,
        });

        const nextDeliverables = pkg.deliverables.map((d) =>
          d.id === deliverable.id
            ? { ...regenerated, id: deliverable.id, status: 'draft' as const }
            : d
        );
        const allErrors = nextDeliverables
          .flatMap((d) => d.lintIssues)
          .filter((i) => i.severity === 'error').length;
        const allWarnings = nextDeliverables
          .flatMap((d) => d.lintIssues)
          .filter((i) => i.severity === 'warning').length;

        const updatedPkg: CampaignPackage = {
          ...pkg,
          deliverables: nextDeliverables,
          lintSummary: {
            passed: allErrors === 0,
            errorCount: allErrors,
            warningCount: allWarnings,
          },
          updatedAt: nowIso(),
        };

        await savePackage(updatedPkg);
        setPackages((prev) => prev.map((p) => (p.id === pkg.id ? updatedPkg : p)));
        pushToast(`Updated ${deliverable.title}.`, 'success');
      } catch (err) {
        pushToast(
          err instanceof Error ? err.message : 'Could not update deliverable.',
          'danger'
        );
      } finally {
        setRegeneratingDeliverableId(null);
      }
    },
    [businessProfile, guardrails, isConfigured, pushToast, regeneratingDeliverableId, settings]
  );

  const handleToggleChecklistTask = useCallback(async (pkgId: string, taskId: string) => {
    setPackages((prev) => {
      const target = prev.find((p) => p.id === pkgId);
      if (!target) return prev;
      const updated: CampaignPackage = {
        ...target,
        checklist: target.checklist.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
        updatedAt: nowIso(),
      };
      savePackage(updated).catch(() => {});
      return prev.map((p) => (p.id === pkgId ? updated : p));
    });
  }, []);

  const handleToggleDeliverableApprove = useCallback(
    async (pkgId: string, deliverableId: string) => {
      setPackages((prev) => {
        const target = prev.find((p) => p.id === pkgId);
        if (!target) return prev;
        const updated: CampaignPackage = {
          ...target,
          deliverables: target.deliverables.map((d) =>
            d.id === deliverableId
              ? { ...d, status: d.status === 'approved' ? 'draft' : 'approved' }
              : d
          ),
          updatedAt: nowIso(),
        };
        savePackage(updated).catch(() => {});
        return prev.map((p) => (p.id === pkgId ? updated : p));
      });
    },
    []
  );

  const handleSaveDeliverableToLibrary = useCallback(
    async (
      pkgName: string | null,
      deliverable: CampaignDeliverable,
      type: LibraryItemType
    ) => {
      const item: LibraryItem = {
        id: generateId(),
        title: pkgName ? `${pkgName} — ${deliverable.title}` : deliverable.title,
        content: deliverable.markdown,
        type,
        tags: ['hedetangen', deliverable.kind],
        createdAt: nowIso(),
      };
      await saveLibraryItem(item);
      setLibrary((prev) => [item, ...prev]);
      pushToast('Saved deliverable to Content Library.', 'success');
    },
    [pushToast]
  );

  const panelTitles: Record<Exclude<ActivePanel, null>, string> = {
    chats: `Chats (${chats.length})`,
    settings: 'Settings',
    library: `Content Library (${library.length})`,
    experts: 'Specialist Experts',
    guardrails: 'Brand DNA Guardrails',
    profile: 'Business Profile',
  };

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
              setWorkspaceView('chat');
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

        {/* Zone 2: Clean single-line text links (desktop, max 5 links) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => setWorkspaceView('chat')}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              workspaceView === 'chat' && !activePanel ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('campaigns')}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              workspaceView === 'campaigns' ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Campaigns{packages.length > 0 ? ` (${packages.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('modules')}
            className={`hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              workspaceView === 'modules' ? 'text-[var(--text)] underline' : ''
            }`}
          >
            Modules
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
          {workspaceView === 'chat' && (
            <>
              <div className="px-4 sm:px-6 py-2 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="font-medium hover:text-[var(--text)] transition-colors"
                  >
                    + New chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePanel((p) => (p === 'chats' ? null : 'chats'))}
                    className="font-medium hover:text-[var(--text)] transition-colors"
                  >
                    Chats ({chats.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePanel((p) => (p === 'profile' ? null : 'profile'))}
                    className="hidden sm:inline font-medium hover:text-[var(--text)] transition-colors"
                  >
                    Business Profile
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openWinterBookingsWizard}
                    className="font-semibold text-[var(--tangerine)] hover:underline underline-offset-4 transition-colors"
                  >
                    Winter Bookings Package →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWizardDraft(null);
                      setWizardOpen(true);
                    }}
                    className="hidden sm:inline font-semibold text-[var(--text)] hover:text-[var(--tangerine)] transition-colors"
                  >
                    Custom Campaign →
                  </button>
                </div>
              </div>

              <ChatList
                messages={messages}
                loading={loadingChat}
                isConfigured={isConfigured}
                streamingState={streamingState}
                altModelId={altModelId}
                businessProfile={businessProfile}
                onSelectSuggestion={(text) => {
                  setDraft(text);
                  composerInputRef.current?.focus();
                }}
                onOpenSettings={() => setActivePanel('settings')}
                onEnableDemoMode={handleEnableDemoMode}
                onOpenCampaignBuilder={(prefill) => {
                  setWizardDraft(prefill);
                  setWizardOpen(true);
                }}
                onSaveToLibrary={handleSaveToLibrary}
                onErrorAction={handleErrorAction}
                onContinue={handleContinueMessage}
                onCopy={handleCopyText}
              />

              <Composer
                draft={draft}
                onDraftChange={setDraft}
                referencePhoto={referencePhoto}
                onReferencePhotoChange={setReferencePhoto}
                onSend={handleSend}
                onStop={handleStop}
                onOpenWizard={openWinterBookingsWizard}
                onOpenSettings={() => setActivePanel('settings')}
                onEnableDemoMode={handleEnableDemoMode}
                isStreaming={streamingState.active}
                isConfigured={isConfigured}
                inputRef={composerInputRef}
              />
            </>
          )}

          {workspaceView === 'campaigns' && (
            <PackageView
              packages={packages}
              activePackageId={activePackageId}
              businessProfile={businessProfile}
              regeneratingDeliverableId={regeneratingDeliverableId}
              onSelectPackage={setActivePackageId}
              onNewPackage={() => {
                setWizardDraft(null);
                setWizardOpen(true);
              }}
              onNewWinterPackage={openWinterBookingsWizard}
              onToggleChecklistTask={handleToggleChecklistTask}
              onToggleDeliverableApprove={handleToggleDeliverableApprove}
              onRegenerateDeliverable={handleRegenerateDeliverable}
              onSaveDeliverableToLibrary={(pkg, d, type) =>
                handleSaveDeliverableToLibrary(pkg.name, d, type)
              }
              onAskJenniferRevise={(pkg) => {
                setActivePackageId(pkg.id);
                setWorkspaceView('chat');
                setDraft(
                  `For our active campaign "${pkg.name}", please help revise: `
                );
                window.setTimeout(() => composerInputRef.current?.focus(), 50);
              }}
              onDeletePackage={async (id) => {
                await deletePackage(id);
                setPackages((prev) => {
                  const next = prev.filter((p) => p.id !== id);
                  if (activePackageId === id) {
                    setActivePackageId(next[0]?.id ?? null);
                  }
                  return next;
                });
                pushToast('Campaign package deleted.', 'info');
              }}
              onCopy={handleCopyText}
              onNotify={pushToast}
            />
          )}

          {workspaceView === 'modules' && (
            <ModulesView
              settings={settings}
              guardrails={guardrails}
              businessProfile={businessProfile}
              packages={packages}
              isConfigured={isConfigured}
              onOpenSettings={() => setActivePanel('settings')}
              onEnableDemoMode={handleEnableDemoMode}
              onSaveToLibrary={(deliverable, type) =>
                handleSaveDeliverableToLibrary(null, deliverable, type)
              }
              onCopy={handleCopyText}
              onNotify={pushToast}
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
                    localStorage.setItem(LS_KEYS.RAIL_PINNED, String(next));
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
                  onOpenProfile={() => setActivePanel('profile')}
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

              {activePanel === 'profile' && (
                <BusinessProfileEditor
                  profile={businessProfile}
                  onSaveProfile={async (next) => {
                    const saved = await saveBusinessProfile(next);
                    setBusinessProfile(saved);
                  }}
                  onResetProfile={async () => {
                    const restored = await resetBusinessProfile();
                    setBusinessProfile(restored);
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
                setWorkspaceView('chat');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setWorkspaceView('campaigns');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Campaign Packages ({packages.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openWinterBookingsWizard();
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-semibold text-[var(--tangerine)] rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              + Winter Bookings Package
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setWorkspaceView('modules');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Studio Modules
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setWorkspaceView('chat');
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
                setActivePanel('profile');
              }}
              className="w-full min-h-[48px] px-4 text-left text-sm font-medium rounded-2xl hover:bg-[var(--surface)] transition-colors"
            >
              Business Profile
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

      {wizardOpen && (
        <Wizard
          guardrails={guardrails}
          businessProfile={businessProfile}
          defaultLanguage={settings.language}
          initialDraft={wizardDraft}
          isGenerating={pkgGenerating}
          progressLabel={pkgProgressLabel}
          onCancel={() => {
            if (!pkgGenerating) {
              setWizardOpen(false);
              setWizardDraft(null);
            }
          }}
          onStop={() => pkgAbortRef.current?.abort()}
          onGeneratePackage={handleGeneratePackage}
        />
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