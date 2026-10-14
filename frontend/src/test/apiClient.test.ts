import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../api/client.ts';

describe('API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches section trains successfully', async () => {
    const mockTrains = [
      { id: 1, number: '12017', category: 'Rajdhani', entry_time: 380, exit_time: 450, weight: 5, section_id: 1 },
    ];

    globalThis.fetch = async (url: any, opts: any) => {
      assert.ok(String(url).includes('/trains?section_id=1'));
      return {
        ok: true,
        json: async () => mockTrains,
      } as any;
    };

    const result = await api.getTrains(1);
    assert.deepEqual(result, mockTrains);
  });

  it('normalizes HTTP 400 errors from backend detail string', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'km_from must be <= km_to' }),
      } as any;
    };

    await assert.rejects(
      async () => {
        await api.createRequest({
          dept: 'Engineering',
          section_id: 1,
          km_from: 30,
          km_to: 20,
          duration_min: 60,
          window_start: 600,
          window_end: 800,
          work_type: 'track_repair',
        });
      },
      {
        name: 'ApiError',
        message: 'km_from must be <= km_to',
      }
    );
  });

  it('handles network failure with helpful message', async () => {
    globalThis.fetch = async () => {
      throw new Error('Connection refused');
    };

    await assert.rejects(
      async () => {
        await api.getHealth();
      },
      /Network connection failed/
    );
  });
});
