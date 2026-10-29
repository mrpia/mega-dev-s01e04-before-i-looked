import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with ok / retry / fail counts per job', async () => {
    const html = await (await createApp(config).request('/')).text();
    // 2026-10-28: rotate-logs, lane/sync, fixtures/refresh, digest/render end ok; notes/backup ends fail; 1 truncated line.
    expect(html).toMatch(/<a href="\/digest\/2026-10-28">2026-10-28<\/a> · 4 ok · 0 retry · 1 fail/);
    expect(html).toContain('1 unreadable');
    // 2026-10-27: rotate-logs, lane/sync, fixtures/refresh, notes/backup all end ok.
    expect(html).toMatch(/<a href="\/digest\/2026-10-27">2026-10-27<\/a> · 4 ok · 0 retry · 0 fail/);
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
