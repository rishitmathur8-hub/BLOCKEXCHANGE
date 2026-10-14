export interface QueuedAction {
  id: string;
  type: 'START_BLOCK' | 'END_BLOCK';
  blockId: number;
  payload: {
    at_minute?: number;
    overrun_reason?: string;
    remarks?: string;
  };
  timestamp: string;
  synced: boolean;
  error?: string;
}

const STORAGE_KEY = 'blockexchange_offline_queue';

export function getOfflineQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save offline queue', err);
  }
}

export function enqueueAction(
  type: 'START_BLOCK' | 'END_BLOCK',
  blockId: number,
  payload: { at_minute?: number; overrun_reason?: string; remarks?: string }
): QueuedAction {
  const queue = getOfflineQueue();
  const action: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    blockId,
    payload,
    timestamp: new Date().toISOString(),
    synced: false,
  };
  queue.push(action);
  saveOfflineQueue(queue);
  return action;
}

export function removeQueuedAction(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(queue);
}

export function clearSyncedActions(): void {
  const queue = getOfflineQueue().filter((item) => !item.synced);
  saveOfflineQueue(queue);
}
