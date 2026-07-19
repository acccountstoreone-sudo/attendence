/**
 * useOfflineQueue — IndexedDB-backed offline attendance queue (P45)
 *
 * When the device has no internet connection, check-in/out records are
 * saved to IndexedDB. When connectivity is restored, the hook auto-syncs
 * the queued records to the server via /api/attendance/sync-offline.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface OfflineRecord {
  id: string; // local uuid
  type: 'check_in' | 'check_out';
  timestamp: string; // ISO string — the REAL time the action happened
  latitude: number;
  longitude: number;
  face_verified: boolean;
  faceDescriptor: number[];
  liveness_passed: boolean;
  photo_url?: string;
  synced: boolean;
  retry_count: number;
  created_at: string;
}

const DB_NAME = 'attendify_offline';
const STORE_NAME = 'attendance_queue';
const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Bug 6 fix: IDB singleton — reuse one connection instead of opening a new
// one per operation, which caused connection floods and sporadic
// "DOMException: The database connection is closing" errors in Chrome.
// ---------------------------------------------------------------------------
let _dbInstance: IDBDatabase | null = null;
let _dbOpenPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  // Bug 8 fix: SSR guard — IndexedDB is not available on the server.
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (_dbInstance) return Promise.resolve(_dbInstance);
  if (_dbOpenPromise) return _dbOpenPromise;

  _dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
    req.onsuccess = () => {
      _dbInstance = req.result;
      // If the connection is closed externally (e.g. version change), reset the
      // singleton so the next call re-opens cleanly.
      _dbInstance.addEventListener('close', () => {
        _dbInstance = null;
        _dbOpenPromise = null;
      });
      resolve(_dbInstance);
    };
    req.onerror = () => {
      _dbOpenPromise = null;
      reject(req.error);
    };
  });

  return _dbOpenPromise;
}

async function getAllRecords(): Promise<OfflineRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineRecord[]);
    req.onerror = () => reject(req.error);
  });
}

async function putRecord(record: OfflineRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteRecord(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Bug 7 fix: module-level sync lock prevents concurrent syncs from multiple
// component instances or rapid re-mounts. Previously each hook instance had
// its own useRef, so two mounts would both enter syncNow simultaneously and
// could double-POST the same records.
// ---------------------------------------------------------------------------
let _syncInProgress = false;

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // Keep a local ref for UI state only (not used for the global lock anymore)
  const isMounted = useRef(true);

  // Track pending unsynced records count
  const refreshCount = useCallback(async () => {
    try {
      const all = await getAllRecords();
      if (isMounted.current) {
        setPendingCount(all.filter((r) => !r.synced).length);
      }
    } catch {
      // IndexedDB not available (e.g., server render) — ignore
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setTimeout(() => refreshCount(), 0);
    return () => {
      isMounted.current = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshCount]);

  // Auto-sync when we come back online
  const syncNow = useCallback(async () => {
    // Bug 7 fix: use module-level lock instead of per-instance useRef
    if (_syncInProgress) return;
    _syncInProgress = true;
    if (isMounted.current) setSyncing(true);

    try {
      const all = await getAllRecords();
      const pending = all.filter((r) => !r.synced && r.retry_count < 5);

      for (const record of pending) {
        try {
          const res = await fetch('/api/attendance/sync-offline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
          });
          if (res.ok) {
            await deleteRecord(record.id);
          } else {
            // Increment retry count but keep the record
            await putRecord({ ...record, retry_count: record.retry_count + 1 });
          }
        } catch {
          await putRecord({ ...record, retry_count: record.retry_count + 1 });
        }
      }
    } finally {
      _syncInProgress = false;
      if (isMounted.current) setSyncing(false);
      refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    if (isOnline) syncNow();
  }, [isOnline, syncNow]);

  /** Enqueue a new check-in or check-out for offline storage */
  const enqueue = useCallback(
    async (
      type: 'check_in' | 'check_out',
      data: Omit<OfflineRecord, 'id' | 'type' | 'synced' | 'retry_count' | 'created_at' | 'timestamp'> & { timestamp?: string }
    ): Promise<string> => {
      const record: OfflineRecord = {
        id: generateId(),
        type,
        timestamp: data.timestamp ?? new Date().toISOString(),
        latitude: data.latitude,
        longitude: data.longitude,
        face_verified: data.face_verified,
        faceDescriptor: data.faceDescriptor,
        liveness_passed: data.liveness_passed,
        photo_url: data.photo_url,
        synced: false,
        retry_count: 0,
        created_at: new Date().toISOString(),
      };
      await putRecord(record);
      await refreshCount();
      return record.id;
    },
    [refreshCount]
  );

  return {
    isOnline,
    pendingCount,
    syncing,
    enqueue,
    syncNow,
    refreshCount,
  };
}
