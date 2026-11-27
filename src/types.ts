export type ProviderId = 'groq' | 'openrouter' | 'openai' | 'mock';
export type LanguagePref = 'auto' | 'sv' | 'en' | 'bilingual';
export type ThemeMode = 'light' | 'dark';
export type ResponseMode = 'direct' | 'team';
export type MessageRole = 'user' | 'jennifer' | 'expert' | 'system';
export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error';
export type LibraryItemType = 'copy' | 'campaign' | 'research' | 'visual-brief' | 'note';
export type ActivePanel =
  | 'settings'
  | 'library'
  | 'experts'
  | 'guardrails'
  | 'chats'
  | 'profile'
  | null;

export type WorkspaceView = 'chat' | 'campaigns' | 'modules';

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
  responseMode?: ResponseMode;
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
  | 'KEY_MISSING'
  | 'KEY_UNREADABLE'
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

export interface BusinessProfile {
  businessName: string;
  owners: string[];
  location: string;
  tagline: string;
  website: string;
  accommodation: string;
  unitCapacityGuests: number;
  defaultRatePerPersonNightSek: number;
  offerings: string[];
  extras: string[];
  verifiedPress: string[];
  voice: string;
  defaultChannels: string[];
  updatedAt: string;
}

export type CampaignDeliverableKind =
  | 'social'
  | 'email'
  | 'ad'
  | 'calendar'
  | 'video'
  | 'landing'
  | 'research';

export interface HonestyLintIssue {
  code: 'INVENTED_STRUCTURE' | 'WEATHER_GUARANTEE' | 'UNSUPPLIED_PRICE_OR_DISCOUNT';
  severity: 'error' | 'warning';
  message: string;
  snippet?: string;
}

export interface CampaignIntake {
  goal: string;
  audiences: string[];
  language: LanguagePref;
  channels: string[];
  deliverables: CampaignDeliverableKind[];
  dateWindow: string;
  openNightsOrCapacity: string;
  coreOffer: string;
  priceAnchor?: string;
  budgetCeiling: string;
  hoursPerWeek: string;
  referencePhoto?: string;
  notes?: string;
}

export interface CampaignChecklistTask {
  id: string;
  phase: string;
  text: string;
  owner?: string;
  done: boolean;
}

export interface CampaignStrategyPhase {
  title: string;
  timing: string;
  tasks: string[];
}

export interface CampaignStrategy {
  headline: string;
  positioning: string;
  rankedChannels: Array<{
    channel: string;
    priority: number;
    rationale: string;
  }>;
  phases: CampaignStrategyPhase[];
  assumptions: string[];
  risks: string[];
  stopSpendThreshold: string;
}

export interface CampaignCalendarItem {
  date: string;
  channel: string;
  item: string;
  notes: string;
  cta?: string;
}

export interface CampaignDeliverable {
  id: string;
  kind: CampaignDeliverableKind;
  title: string;
  markdown: string;
  structured: unknown;
  lintIssues: HonestyLintIssue[];
  repaired: boolean;
  status: 'draft' | 'approved';
  createdAt: string;
}

export interface CampaignPackage {
  id: string;
  name: string;
  status: 'draft' | 'ready' | 'delivered';
  intake: CampaignIntake;
  strategy: CampaignStrategy;
  checklist: CampaignChecklistTask[];
  deliverables: CampaignDeliverable[];
  lintSummary: {
    passed: boolean;
    errorCount: number;
    warningCount: number;
  };
  sourceChatId?: string;
  createdAt: string;
  updatedAt: string;
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
  businessProfile?: BusinessProfile;
  packages?: CampaignPackage[];
  chats?: Array<{
    chat: Chat;
    messages: ChatMessage[];
  }>;
}
