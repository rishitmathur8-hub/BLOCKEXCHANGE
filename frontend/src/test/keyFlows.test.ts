import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../api/client.ts';

describe('Key Operational Flows', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Flow 1: Submitting new request and detecting corridor overlaps', async () => {
    const mockCreated = {
      id: 99,
      dept: 'Engineering',
      section_id: 1,
      km_from: 22,
      km_to: 28,
      duration_min: 90,
      window_start: 600,
      window_end: 800,
      work_type: 'track_repair',
      needs_power_block: false,
      block_id: null,
    };

    const mockOverlap = {
      has_overlaps: true,
      overlapping_requests: [mockCreated],
      overlapping_blocks: [],
      merge_candidate: true,
      reason: 'Found 1 overlapping request on this section.',
    };

    let callCount = 0;
    globalThis.fetch = async (url: any, opts: any) => {
      callCount++;
      if (String(url).includes('/check-overlap')) {
        return {
          ok: true,
          json: async () => mockOverlap,
        } as any;
      }
      return {
        ok: true,
        json: async () => mockCreated,
      } as any;
    };

    // 1. Overlap Check
    const overlapRes = await api.checkOverlap({
      section_id: 1,
      km_from: 22,
      km_to: 28,
      window_start: 600,
      window_end: 800,
      duration_min: 90,
    });
    assert.equal(overlapRes.has_overlaps, true);
    assert.equal(overlapRes.merge_candidate, true);

    // 2. Submission
    const created = await api.createRequest(mockCreated);
    assert.equal(created.id, 99);
    assert.equal(created.dept, 'Engineering');
    assert.equal(callCount, 2);
  });

  it('Flow 2: Merge Decision confirmation and audit entry', async () => {
    const mockApprovedBlock = {
      id: 55,
      section_id: 1,
      start: 600,
      end: 720,
      status: 'approved',
      request_ids: [1, 2, 3],
    };

    const mockAudit = {
      id: 1,
      timestamp: '2026-10-14T10:30:00',
      user_role: 'Section Controller',
      user_name: 'V. K. Aggarwal',
      action: 'APPROVE_BLOCK',
      entity_type: 'block',
      entity_id: '55',
      reason: 'Approved joint multi-department closure.',
      details: 'Merged Engineering, S&T, OHE.',
    };

    globalThis.fetch = async (url: any) => {
      if (String(url).includes('/approve')) {
        return {
          ok: true,
          json: async () => mockApprovedBlock,
        } as any;
      }
      return {
        ok: true,
        json: async () => mockAudit,
      } as any;
    };

    const approved = await api.approveBlock(55, 'V. K. Aggarwal');
    assert.equal(approved.status, 'approved');

    const audit = await api.createAuditLog({
      user_role: 'Section Controller',
      user_name: 'V. K. Aggarwal',
      action: 'APPROVE_BLOCK',
      entity_type: 'block',
      entity_id: '55',
      reason: 'Approved joint multi-department closure.',
    });
    assert.equal(audit.action, 'APPROVE_BLOCK');
    assert.equal(audit.user_role, 'Section Controller');
  });

  it('Flow 3: Field Staff check-in and check-out with overrun calculation', async () => {
    const mockStartedBlock = {
      id: 55,
      section_id: 1,
      start: 600,
      end: 720,
      status: 'started',
      request_ids: [1, 2, 3],
    };

    const mockEndedBlock = {
      id: 55,
      section_id: 1,
      start: 600,
      end: 720,
      status: 'overrun',
      request_ids: [1, 2, 3],
      overrun_min: 25,
    };

    globalThis.fetch = async (url: any) => {
      if (String(url).includes('/start')) {
        return {
          ok: true,
          json: async () => mockStartedBlock,
        } as any;
      }
      return {
        ok: true,
        json: async () => mockEndedBlock,
      } as any;
    };

    const started = await api.startBlock(55, 605);
    assert.equal(started.status, 'started');

    const ended = await api.endBlock(55, 745, 'crew shortage');
    assert.equal(ended.status, 'overrun');
    assert.equal(ended.overrun_min, 25);
  });
});
