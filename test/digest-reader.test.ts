import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/readNight.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('counts valid lines by status: 10 ok, 4 retry, 1 fail', () => {
    expect(night?.statusCounts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('counts retries and keeps the last error', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('shows a failed job with its error', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', runs: 1 });
  });

  it('keeps a row whose owner is null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, lastStatus: 'ok', lastError: null });
  });

  it('keeps times exactly as in the log, offset included', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edge cases', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(tempRuns({}), '2026-10-01')).toBeNull();
  });

  it('returns null for a night that is not a date', () => {
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('reads an empty file as a night where nothing ran', () => {
    expect(readNight(tempRuns({ '2026-10-02.jsonl': '' }), '2026-10-02')).toEqual({
      night: '2026-10-02',
      rows: [],
      badLines: 0,
      statusCounts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts valid JSON that is not a record as a bad line', () => {
    const lines = [
      '{"at":"2026-10-03T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-10-03T01:00:00+02:00","status":"ok","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-10-03T01:00:00+02:00","job":"a","status":"maybe","owner":"x"}',
      '[1,2]',
      'null',
      '',
    ];
    const n = readNight(tempRuns({ '2026-10-03.jsonl': lines.join('\n') }), '2026-10-03');
    expect(n?.badLines).toBe(5);
    expect(n?.rows).toHaveLength(1);
    expect(n?.rows[0]).toMatchObject({ job: 'a', runs: 1 });
  });

  it('orders by time, not file order, and reports the latest line', () => {
    const lines = [
      '{"at":"2026-10-04T03:00:00+01:00","job":"a","status":"fail","owner":"y","error":"late"}',
      '{"at":"2026-10-04T01:00:00+01:00","job":"a","status":"retry","owner":"x","error":"early"}',
    ];
    const n = readNight(tempRuns({ '2026-10-04.jsonl': lines.join('\n') }), '2026-10-04');
    expect(n?.rows[0]).toMatchObject({
      owner: 'y',
      lastStatus: 'fail',
      lastError: 'late',
      firstAt: '2026-10-04T01:00:00+01:00',
      lastAt: '2026-10-04T03:00:00+01:00',
    });
  });
});
