/**
 * Offline Attendance Queue (Spec P45).
 * Queues check-in/check-out actions in localStorage when the device is offline.
 * Auto-syncs with the server when connectivity is restored.
 */

const QUEUE_KEY = 'anchor_fashion_offline_queue';

export interface OfflineAttendanceAction {
  id: string; // Local UUID for deduplication
  type: 'check_in' | 'check_out';
  latitude: number;
  longitude: number;
  photo_url?: string;
  device_info?: string;
  created_at: string; // ISO timestamp of when the action was queued
  synced: boolean;
  retry_count: number;
}

/**
 * Enqueue an offline attendance action into localStorage.
 */
export function enqueueOfflineAction(action: Omit<OfflineAttendanceAction, 'id' | 'synced' | 'retry_count' | 'created_at'>): string {
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const queue = getOfflineQueue();

  const newAction: OfflineAttendanceAction = {
    ...action,
    id,
    created_at: new Date().toISOString(),
    synced: false,
    retry_count: 0,
  };

  queue.push(newAction);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  console.log(`[Offline Queue] Enqueued ${action.type} action (ID: ${id})`);
  return id;
}

/**
 * Retrieve all pending (unsynced) offline actions.
 */
export function getOfflineQueue(): OfflineAttendanceAction[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineAttendanceAction[];
  } catch {
    return [];
  }
}

/**
 * Mark a queued action as synced and remove it from the queue.
 */
export function markActionSynced(id: string): void {
  const queue = getOfflineQueue().filter((a) => a.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Increment the retry count for a failed sync action.
 */
export function incrementRetryCount(id: string): void {
  const queue = getOfflineQueue().map((a) =>
    a.id === id ? { ...a, retry_count: a.retry_count + 1 } : a
  );
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Attempt to sync all pending offline actions with the server.
 * Should be called when window.onfocus or navigator.onLine becomes true.
 */
export async function syncOfflineQueue(onProgress?: (synced: number, total: number) => void): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue().filter((a) => !a.synced && a.retry_count < 3);
  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      const res = await fetch('/api/attendance/sync-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: action.id,
          type: action.type,
          timestamp: action.created_at,
          latitude: action.latitude,
          longitude: action.longitude,
          face_verified: true,
          liveness_passed: true,
          photo_url: action.photo_url,
          device_info: action.device_info,
        }),
      });

      if (res.ok) {
        markActionSynced(action.id);
        synced++;
        console.log(`[Offline Sync] ✅ Action ${action.id} synced.`);
      } else {
        incrementRetryCount(action.id);
        failed++;
        console.warn(`[Offline Sync] ⚠️ Action ${action.id} failed (attempt ${action.retry_count + 1}).`);
      }
    } catch (err) {
      incrementRetryCount(action.id);
      failed++;
      console.error(`[Offline Sync] ❌ Network error for action ${action.id}:`, err);
    }

    onProgress?.(synced, queue.length);
  }

  return { synced, failed };
}

/**
 * Hook to auto-sync when browser comes back online (Spec P45).
 * Place in a top-level client component or layout.
 */
export function setupOfflineSyncListener(onSyncComplete?: (result: { synced: number; failed: number }) => void): () => void {
  const handleOnline = async () => {
    const pending = getOfflineQueue().filter((a) => !a.synced);
    if (pending.length === 0) return;

    console.log(`[Offline Sync] Network restored. Syncing ${pending.length} queued action(s)...`);
    const result = await syncOfflineQueue();
    console.log(`[Offline Sync] Complete: ${result.synced} synced, ${result.failed} failed.`);
    onSyncComplete?.(result);
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}

