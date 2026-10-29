import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Json = { night: string; rows: { job: string }[]; badLines: number };

const line = (o: Record<string, unknown>) => JSON.stringify(o);

// Written out of job order on purpose: the reader sorts by job.
const NORMAL = [
  line({ at: '2026-01-01T02:10:00+01:00', job: 'zeta/sync', status: 'ok', owner: 'ana', error: null }),
  line({ at: '2026-01-01T01:00:00+01:00', job: 'alpha/backup', status: 'retry', owner: null, error: 'upstream 503' }),
  line({ at: '2026-01-01T01:05:00+01:00', job: 'alpha/backup', status: 'retry', owner: null, error: 'upstream 503' }),
  line({ at: '2026-01-01T01:10:00+01:00', job: 'alpha/backup', status: 'retry', owner: null, error: 'upstream 503' }),
  line({ at: '2026-01-01T01:15:00+01:00', job: 'alpha/backup', status: 'ok', owner: null, error: null }),
  line({ at: '2026-01-01T03:00:00-05:00', job: 'mid/fail', status: 'fail', owner: 'bo', error: 'disk full' }),
].join('\n');

const BAD = [
  line({ at: '2026-01-03T01:00:00+01:00', job: 'only/job', status: 'ok', owner: 'cy', error: null }),
  '{ this is not json',
].join('\n');

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rig-runs-'));
  await writeFile(join(dir, '2026-01-01.jsonl'), NORMAL + '\n');
  await writeFile(join(dir, '2026-01-02.jsonl'), '');
  await writeFile(join(dir, '2026-01-03.jsonl'), BAD + '\n');
  app = createApp({ adapter: 'test', installed: '', beatEverySeconds: 60, runsDir: dir });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const page = async (night: string) => {
  const res = await app.request(`/digest/${night}`);
  return { status: res.status, html: await res.text() };
};
const api = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { status: res.status, body: (await res.json()) as Json };
};
const row = (html: string, job: string) => html.split('<tr>').find((r) => r.includes(`<td>${job}</td>`)) ?? '';
const jobsInPage = (html: string) => [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);

const SORTED = ['alpha/backup', 'mid/fail', 'zeta/sync'];

describe('GET /digest/:night', () => {
  it('renders a normal night with rows in job order', async () => {
    const { status, html } = await page('2026-01-01');
    expect(status).toBe(200);
    expect(jobsInPage(html)).toEqual(SORTED);
  });

  it('answers 404 for a night with no file', async () => {
    expect((await page('2026-02-01')).status).toBe(404);
  });

  it('answers 404 for a night that is not a date', async () => {
    expect((await page('not-a-date')).status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const { status, html } = await page('2026-01-02');
    expect(status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('could not be read');
  });

  it('keeps the valid rows and notes a bad line', async () => {
    const { status, html } = await page('2026-01-03');
    expect(status).toBe(200);
    expect(html).toContain('only/job');
    expect(html).toContain('1 line could not be read');
  });

  it('renders a null owner as a dash', async () => {
    const { html } = await page('2026-01-01');
    expect(row(html, 'alpha/backup')).toContain('<td>—</td>');
    expect(row(html, 'zeta/sync')).toContain('<td>ana</td>');
  });

  it('marks 3 retries and a last status of fail with warn, and nothing else', async () => {
    const { html } = await page('2026-01-01');
    expect(row(html, 'alpha/backup')).toContain('<td class="warn">3</td>');
    expect(row(html, 'alpha/backup')).not.toContain('<td class="warn">ok');
    expect(row(html, 'mid/fail')).toContain('<td class="warn">fail</td>');
    expect(row(html, 'zeta/sync')).not.toContain('warn');
  });

  it('shows times exactly as written, offset kept', async () => {
    const { html } = await page('2026-01-01');
    expect(row(html, 'alpha/backup')).toContain('2026-01-01T01:00:00+01:00');
    expect(row(html, 'alpha/backup')).toContain('2026-01-01T01:15:00+01:00');
    expect(row(html, 'mid/fail')).toContain('2026-01-01T03:00:00-05:00');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns a normal night with rows in job order', async () => {
    const { status, body } = await api('2026-01-01');
    expect(status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(SORTED);
  });

  it('answers 404 with a small JSON body for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-02-01' });
  });

  it('answers 404 for a night that is not a date', async () => {
    expect((await api('not-a-date')).status).toBe(404);
  });

  it('returns no rows and no bad lines for an empty file', async () => {
    const { status, body } = await api('2026-01-02');
    expect(status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line and keeps the valid rows', async () => {
    const { status, body } = await api('2026-01-03');
    expect(status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['only/job']);
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-01-01', '2026-01-02', '2026-01-03'])('same jobs in the same order for %s', async (night) => {
    const [p, j] = await Promise.all([page(night), api(night)]);
    expect(jobsInPage(p.html)).toEqual(j.body.rows.map((r) => r.job));
  });
});
