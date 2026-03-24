/**
 * Offline Operation Queue
 * IndexedDB-based queue for storing scan operations when offline.
 * Automatically syncs when connection is restored.
 */

const DB_NAME = 'swiftstock-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';

interface PendingOperation {
  id?: number;
  type: 'SCAN' | 'TRANSACTION' | 'COUNT';
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineQueue = {
  /** Add operation to offline queue */
  async enqueue(type: PendingOperation['type'], payload: Record<string, unknown>): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const op: PendingOperation = { type, payload, timestamp: Date.now(), retries: 0 };
      const req = store.add(op);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  },

  /** Get all pending operations */
  async getAll(): Promise<PendingOperation[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /** Remove a successfully synced operation */
  async remove(id: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /** Get count of pending operations */
  async count(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /** Clear all pending operations */
  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Sync all pending operations to the server.
   * @param syncFn - Function that sends a single operation to the server. Returns true on success.
   * @returns Number of successfully synced operations.
   */
  async syncAll(syncFn: (op: PendingOperation) => Promise<boolean>): Promise<number> {
    const pending = await this.getAll();
    let synced = 0;

    for (const op of pending) {
      try {
        const success = await syncFn(op);
        if (success && op.id !== undefined) {
          await this.remove(op.id);
          synced++;
        }
      } catch {
        // Leave in queue for next sync attempt
      }
    }

    return synced;
  },
};

/**
 * Setup automatic sync on reconnect.
 * Call this once in App.tsx or Layout.tsx.
 */
export function setupOfflineSync(syncFn: (op: PendingOperation) => Promise<boolean>) {
  window.addEventListener('online', async () => {
    const count = await offlineQueue.count();
    if (count > 0) {
      console.log(`[OfflineQueue] Online — syncing ${count} pending operations...`);
      const synced = await offlineQueue.syncAll(syncFn);
      console.log(`[OfflineQueue] Synced ${synced}/${count} operations`);
    }
  });
}

export type { PendingOperation };
