/**
 * localStorage can throw (Safari private mode, blocked third-party storage,
 * quota exhaustion). Persistence must degrade instead of crashing the app.
 */

export function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Non-fatal: the value is a cache, not the source of truth.
  }
}
