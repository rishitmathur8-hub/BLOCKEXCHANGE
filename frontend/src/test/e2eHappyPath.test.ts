import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../api/client.ts';
import { fmtMinutes, parseTimeToMinutes } from '../utils/time.ts';

describe('End-to-End Operational Lifecycle Happy Path', () => {
  it('executes full Indian Railways maintenance closure workflow', async () => {
    // Stage 1: System Baseline Loading
    const mockSections = [
      { id: 1, name: 'Saharanpur-Ambala', from_station: 'Saharanpur', to_station: 'Ambala', length_km: 85.0 },
    ];
    const mockTrains = [
      { id: 1, number: '12017', category: 'Rajdhani', entry_time: 600, exit_time: 655, weight: 5, section_id: 1 },
      { id: 2, number: '14012', category: 'Express', entry_time: 630, exit_time: 705, weight: 3, section_id: 1 },
    ];

    // Stage 2: Submit Requisition with Overlap Check
    const newReqInput = {
      dept: 'Engineering',
      section_id: 1,
      km_from: 22.0,
      km_to: 28.0,
      duration_min: 120,
      window_start: 600,
      window_end: 960,
      work_type: 'track_repair',
      needs_power_block: false,
    };

    // Stage 3: Merge Optimization Proposal
    const mockProposal = {
      block_id: 77,
      section_id: 1,
      start: 600,
      end: 720,
      depts: ['Engineering', 'S&T', 'OHE'],
      needs_power_block: true,
      requests: [
        { id: 1, ...newReqInput },
        { id: 2, dept: 'S&T', section_id: 1, km_from: 25, km_to: 30, duration_min: 90, window_start: 630, window_end: 960, work_type: 'signal_work', needs_power_block: false },
        { id: 3, dept: 'OHE', section_id: 1, km_from: 20, km_to: 26, duration_min: 90, window_start: 600, window_end: 900, work_type: 'ohe_work', needs_power_block: true },
      ],
    };

    // Stage 4: Approval by Section Controller
    const mockApprovedBlock = {
      id: 77,
      section_id: 1,
      start: 600,
      end: 720,
      status: 'approved',
      request_ids: [1, 2, 3],
      requests: mockProposal.requests,
    };

    // Stage 5: Field Execution (Started -> Ended with Overrun)
    const mockStartedBlock = { ...mockApprovedBlock, status: 'started' };
    const mockEndedBlock = {
      ...mockApprovedBlock,
      status: 'overrun',
      overrun_min: 15,
      event: {
        id: 10,
        block_id: 77,
        planned_duration: 120,
        granted_duration: 120,
        actual_start: 600,
        actual_end: 735,
        overrun_reason: 'equipment failure',
      },
    };

    // Mock API responses sequentially
    const apiCallSequence: string[] = [];
    globalThis.fetch = async (url: any, opts: any) => {
      const path = String(url);
      apiCallSequence.push(`${opts?.method || 'GET'} ${path}`);

      if (path.includes('/sections')) {
        return { ok: true, json: async () => mockSections } as any;
      }
      if (path.includes('/trains')) {
        return { ok: true, json: async () => mockTrains } as any;
      }
      if (path.includes('/requests/check-overlap')) {
        return {
          ok: true,
          json: async () => ({
            has_overlaps: true,
            overlapping_requests: [mockProposal.requests[1], mockProposal.requests[2]],
            overlapping_blocks: [],
            merge_candidate: true,
            reason: 'Found 2 overlapping requests at km 20-30.',
          }),
        } as any;
      }
      if (path.endsWith('/requests') && opts?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 1, ...newReqInput }) } as any;
      }
      if (path.includes('/merge-proposals')) {
        return { ok: true, json: async () => [mockProposal] } as any;
      }
      if (path.includes('/blocks/77/approve')) {
        return { ok: true, json: async () => mockApprovedBlock } as any;
      }
      if (path.includes('/blocks/77/start')) {
        return { ok: true, json: async () => mockStartedBlock } as any;
      }
      if (path.includes('/blocks/77/end')) {
        return { ok: true, json: async () => mockEndedBlock } as any;
      }
      if (path.includes('/audit-logs') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ id: 501, timestamp: '2026-10-14T10:00:00', ...body }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    };

    // Step 1: Load corridor infrastructure
    const sections = await api.getSections();
    assert.equal(sections.length, 1);
    assert.equal(sections[0].name, 'Saharanpur-Ambala');

    // Step 2: Instant Overlap check
    const overlapCheck = await api.checkOverlap({
      section_id: 1,
      km_from: 22,
      km_to: 28,
      window_start: 600,
      window_end: 960,
      duration_min: 120,
    });
    assert.equal(overlapCheck.has_overlaps, true);
    assert.equal(overlapCheck.merge_candidate, true);

    // Step 3: File Requisition
    const req = await api.createRequest(newReqInput);
    assert.equal(req.id, 1);

    // Step 4: Propose Merged Block
    const proposals = await api.getMergeProposals();
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].block_id, 77);
    assert.deepEqual(proposals[0].depts, ['Engineering', 'S&T', 'OHE']);

    // Step 5: Officer Approves Block
    const approved = await api.approveBlock(77, 'V. K. Aggarwal');
    assert.equal(approved.status, 'approved');

    // Step 6: Field Staff Check-in (Work Started)
    const started = await api.startBlock(77, 600);
    assert.equal(started.status, 'started');

    // Step 7: Field Staff Check-out (Work Ended with 15m Overrun)
    const ended = await api.endBlock(77, 735, 'equipment failure');
    assert.equal(ended.status, 'overrun');
    assert.equal(ended.overrun_min, 15);

    // Step 8: Log Audit Entry
    const audit = await api.createAuditLog({
      user_role: 'Field Supervisor',
      user_name: 'Rameshwar Singh',
      action: 'END_WORK',
      entity_type: 'block',
      entity_id: '77',
      reason: 'equipment failure: tamper tamping unit jammed for 15 mins.',
    });
    assert.equal(audit.id, 501);
    assert.equal(audit.entity_id, '77');

    // Verify all stages executed in order
    assert.ok(apiCallSequence.some((c) => c.includes('POST') && c.includes('/check-overlap')));
    assert.ok(apiCallSequence.some((c) => c.includes('POST') && c.includes('/blocks/77/approve')));
    assert.ok(apiCallSequence.some((c) => c.includes('POST') && c.includes('/blocks/77/start')));
    assert.ok(apiCallSequence.some((c) => c.includes('POST') && c.includes('/blocks/77/end')));
    assert.ok(apiCallSequence.some((c) => c.includes('POST') && c.includes('/audit-logs')));
  });
});
