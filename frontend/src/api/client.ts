import type {
  BlockItem,
  BlockRequest,
  MergeProposal,
  Section,
  SlotOption,
  Train,
  OverrunAnalysis,
  AuditEntry,
  OverlapCheckResult,
} from '../types/index.ts';
import { getOfflineQueue, removeQueuedAction, saveOfflineQueue } from '../utils/offlineQueue.ts';

// In development, Vite proxies '/api' to 'http://127.0.0.1:8000'.
// VITE_API_BASE_URL can override with direct URL if needed.
const BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  '/api';


class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let detail = `Server returned HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          detail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
        }
      } catch {
        // use default error message
      }
      throw new ApiError(detail, res.status);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      `Network connection failed. Is the backend running at ${BASE_URL}? (${err.message})`,
      0
    );
  }
}

export const api = {
  // Status
  getHealth: () => request<{ status: string }>('/'),

  // Sections
  getSections: () => request<Section[]>('/sections'),

  // Trains
  getTrains: (sectionId?: number) => {
    const query = sectionId ? `?section_id=${sectionId}` : '';
    return request<Train[]>(`/trains${query}`);
  },

  // Requests (Unassigned)
  getRequests: () => request<BlockRequest[]>('/requests'),

  createRequest: (data: {
    dept: string;
    section_id: number;
    km_from: number;
    km_to: number;
    duration_min: number;
    window_start: number;
    window_end: number;
    work_type: string;
    needs_power_block?: boolean;
  }) =>
    request<BlockRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  checkOverlap: (data: {
    section_id: number;
    km_from: number;
    km_to: number;
    window_start: number;
    window_end: number;
    duration_min: number;
  }) =>
    request<OverlapCheckResult>('/requests/check-overlap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Blocks
  getBlocks: () => request<BlockItem[]>('/blocks'),

  getBlocksDetailed: () => request<BlockItem[]>('/blocks/detailed'),

  approveBlock: (blockId: number, approvedBy: string) =>
    request<BlockItem>(`/blocks/${blockId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_by: approvedBy }),
    }),

  startBlock: (blockId: number, atMinute?: number) =>
    request<BlockItem>(`/blocks/${blockId}/start`, {
      method: 'POST',
      body: JSON.stringify({ at_minute: atMinute }),
    }),

  endBlock: (blockId: number, atMinute?: number, overrunReason?: string) =>
    request<BlockItem & { overrun_min: number }>(`/blocks/${blockId}/end`, {
      method: 'POST',
      body: JSON.stringify({
        at_minute: atMinute,
        overrun_reason: overrunReason,
      }),
    }),

  cancelBlock: (blockId: number) =>
    request<BlockItem>(`/blocks/${blockId}/cancel`, {
      method: 'POST',
    }),

  // Merging & Scheduling
  getMergeProposals: () => request<MergeProposal[]>('/merge-proposals'),

  getBlockOptions: (blockId: number) =>
    request<SlotOption[]>(`/blocks/${blockId}/options`),

  runOptimize: () => request<any>('/optimize', { method: 'POST' }),

  // Predictions
  getPredictBuffers: () => request<Record<string, number>>('/predict/buffers'),

  getOverrunAnalysis: () =>
    request<{ analyses: OverrunAnalysis[]; buffer_history: Record<string, number> }>(
      '/predict/overrun-analysis'
    ),

  // Audit Logs
  getAuditLogs: () => request<AuditEntry[]>('/audit-logs'),

  createAuditLog: (entry: {
    user_role: string;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id: string;
    reason?: string | null;
    details?: string | null;
  }) =>
    request<AuditEntry>('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  // Offline Sync
  syncOfflineQueue: async () => {
    const queue = getOfflineQueue();
    const results = { synced: 0, failed: 0 };
    for (const item of queue) {
      if (item.synced) continue;
      try {
        if (item.type === 'START_BLOCK') {
          await api.startBlock(item.blockId, item.payload.at_minute);
        } else if (item.type === 'END_BLOCK') {
          await api.endBlock(
            item.blockId,
            item.payload.at_minute,
            item.payload.overrun_reason
          );
        }
        item.synced = true;
        removeQueuedAction(item.id);
        results.synced++;
      } catch (err: any) {
        item.error = err.message;
        results.failed++;
      }
    }
    saveOfflineQueue(queue);
    return results;
  },
};
