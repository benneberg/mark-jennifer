import { DB_NAME, DB_VERSION } from '../constants';

export type StoreName =
  | 'experts'
  | 'guardrails'
  | 'chats'
  | 'messages'
  | 'library'
  | 'settings'
  | 'keys'
  | 'crypto'
  | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function runMigrations(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains('experts')) {
      const experts = db.createObjectStore('experts', { keyPath: 'id' });
      experts.createIndex('name', 'name', { unique: false });
      experts.createIndex('enabled', 'enabled', { unique: false });
    }
    if (!db.objectStoreNames.contains('guardrails')) {
      db.createObjectStore('guardrails', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('chats')) {
      const chats = db.createObjectStore('chats', { keyPath: 'id' });
      chats.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
    if (!db.objectStoreNames.contains('messages')) {
      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('chatId', 'chatId', { unique: false });
      messages.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
      messages.createIndex('timestamp', 'timestamp', { unique: false });
    }
    if (!db.objectStoreNames.contains('library')) {
      const library = db.createObjectStore('library', { keyPath: 'id' });
      library.createIndex('type', 'type', { unique: false });
      library.createIndex('createdAt', 'createdAt', { unique: false });
      library.createIndex('tags', 'tags', { unique: false, multiEntry: true });
    }
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('keys')) {
      db.createObjectStore('keys', { keyPath: 'provider' });
    }
    if (!db.objectStoreNames.contains('crypto')) {
      db.createObjectStore('crypto', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta', { keyPath: 'key' });
    }
  }
}

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      runMigrations(db, event.oldVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });
  return dbPromise;
}

export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAllByIndex<T>(
  storeName: StoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const req = index.getAll(query);
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbClearStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClearAllStores(): Promise<void> {
  const stores: StoreName[] = [
    'experts',
    'guardrails',
    'chats',
    'messages',
    'library',
    'settings',
    'keys',
    'crypto',
    'meta',
  ];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    for (const s of stores) {
      tx.objectStore(s).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
