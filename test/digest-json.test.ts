import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp({ adapter: 'test', installed: '', beatEverySeconds: 60, runsDir: 'runs' });

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON, rows in job order', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('answers 404 with a small JSON body for a night with no log', async () => {
    const res = await app.request('/api/digest/2026-10-29');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-10-29' });
  });
});
