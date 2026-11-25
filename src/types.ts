export type ProviderId = 'groq' | 'openrouter' | 'openai' | 'mock';
export type LanguagePref = 'auto' | 'sv' | 'en' | 'bilingual';
export type ThemeMode = 'light' | 'dark';
export type MessageRole = 'user' | 'jennifer' | 'expert' | 'system';
export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error';
export type LibraryItemType = 'copy' | 'campaign' | 'research' | 'visual-brief' | 'note';
export type ActivePanel = 'settings' | 'library' | 'experts' | 'guardrails' | null;

export interface Expert {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  temperature?: number;
  enabled: boolean;
  tags: string[];
  isSeed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailsEditable {
  essence: string;
  materials: string[];
  colourAndLight: string[];
  people: string;
  cinema: string;
  emotion: string;
  avoid: string[];
  extraNotes?: string;
}

export interface GuardrailsSnapshot {
  snapshot: GuardrailsEditable;
  savedAt: string;
}

export interface Guardrails {
  id: 'default';
  version: number;
  editable: GuardrailsEditable;
  honestyRule: string;
  editedBy?: string;
  updatedAt: string;
  history?: GuardrailsSnapshot[];
}

export interface AppSettings {
  provider: ProviderId;
  model: string;
  temperature: number;
  language: LanguagePref;
  machinePrompt: string;
  theme: ThemeMode;
  rememberKey: boolean;
  strictMode: boolean;
  debug: boolean;
}

export interface SessionFacts {
  constraints?: string[];
  audience?: string[];
  budget?: string;
  awards?: string[];
  channels?: string[];
  focus?: string;
  referencePhoto?: string;
  notes?: string[];
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sessionFacts?: SessionFacts;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  expertName?: string;
  content: string;
  timestamp: string;
  status?: MessageStatus;
  savedToLibrary?: boolean;
  turnId?: string;
  handoffText?: string;
  delegatedExperts?: string[];
  errorData?: {
    code: AIErrorCode;
    provider: ProviderId;
    status?: number;
    retryAfterMs?: number;
    modelId?: string;
    lastUserMessage?: string;
  };
}

export interface LibraryItem {
  id: string;
  title: string;
  content: string;
  type: LibraryItemType;
  tags: string[];
  sourceChatId?: string;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  free?: boolean;
  supportsTools?: boolean;
  providerNotes?: string;
  approxRpm?: number;
  approxRpd?: number;
  bestFor?: string[];
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export type AIErrorCode =
  | 'AUTH_INVALID'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_UNSUPPORTED'
  | 'CONTEXT_TOO_LONG'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export interface ToastItem {
  id: string;
  message: string;
  variant?: 'info' | 'success' | 'danger';
}

export interface DebugEntry {
  id: string;
  timestamp: string;
  type: 'turn' | 'error' | 'parse_warn';
  summary: string;
  callCount?: number;
  durationMs?: number;
  details?: unknown;
}

export interface ExportPackage {
  schemaVersion: 1;
  exportedAt: string;
  app: {
    name: 'Hedetangen AI Marketing Studio';
    version: string;
  };
  experts: Expert[];
  guardrails: Guardrails;
  library: LibraryItem[];
  settings: Omit<AppSettings, 'rememberKey'>;
  chats?: Array<{
    chat: Chat;
    messages: ChatMessage[];
  }>;
}
