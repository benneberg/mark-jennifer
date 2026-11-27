export const APP_NAME = 'Hedetangen AI Marketing Studio';
export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;

export const DB_NAME = 'hedetangen-studio';
export const DB_VERSION = 1;

export const LS_KEYS = {
  THEME: 'hedetangen.theme',
  LAST_PROVIDER: 'hedetangen.lastProvider',
  LAST_MODEL: 'hedetangen.lastModel',
  LAST_MODEL_BY_PROVIDER: 'hedetangen.lastModelByProvider',
  ONBOARDED: 'hedetangen.onboarded',
  RAIL_PINNED: 'hedetangen.railPinned',
} as const;

export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const HISTORY_MAX_MESSAGES = 8;
export const HISTORY_MAX_EXPERT_MESSAGES = 2;
export const HISTORY_MAX_TOKENS_APPROX = 3200;
export const CHAT_DISPLAY_CAP = 500;
export const REQUEST_TIMEOUT_MS = 60000;
export const STREAM_CHUNK_TIMEOUT_MS = 45000;
export const MAX_DELEGATES_PER_TURN = 3;
export const PLANNER_MAX_TOKENS = 750;
export const EXPERT_MAX_TOKENS = 1200;
export const SYNTHESIS_MAX_TOKENS = 2400;
export const DIRECT_CHAT_MAX_TOKENS = 3200;

export const PRIVACY_NOTICE =
  'Hedetangen AI Studio runs entirely in your browser. Your API key and your content are stored on this device only. When you chat, your message is sent directly to your chosen provider using your key. Nothing is sent to Hedetangen or any other server. Export your data regularly if you want a backup.';
