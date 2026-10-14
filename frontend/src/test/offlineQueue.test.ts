import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// In-memory mock for localStorage in node test environment
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  length: 0,
  key: () => null,
};

import {
  enqueueAction,
  getOfflineQueue,
  saveOfflineQueue,
  removeQueuedAction,
} from '../utils/offlineQueue.ts';

describe('Field Staff Offline Queue', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('enqueues work started action when offline', () => {
    const action = enqueueAction('START_BLOCK', 42, { at_minute: 600, remarks: 'Caution flags set' });
    assert.equal(action.type, 'START_BLOCK');
    assert.equal(action.blockId, 42);
    assert.equal(action.payload.at_minute, 600);
    assert.equal(action.synced, false);

    const queue = getOfflineQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, action.id);
  });

  it('removes action when synced', () => {
    const action = enqueueAction('END_BLOCK', 42, { at_minute: 720, overrun_reason: 'material late' });
    assert.equal(getOfflineQueue().length, 1);

    removeQueuedAction(action.id);
    assert.equal(getOfflineQueue().length, 0);
  });
});
