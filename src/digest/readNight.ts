import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight } from './types.js';

// Plan morning-digest § 1. Parse at the edge: a line becomes a LogLine or it is a bad line.

type LogLine = { at: string; time: number; job: string; status: JobStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies JobStatus[];

function isStatus(v: unknown): v is JobStatus {
  return typeof v === 'string' && STATUSES.includes(v);
}

export function parseLine(text: string): LogLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const { at, job, status, owner, error } = r;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '' || !isStatus(status)) return null;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, time, job, status, owner: owner ?? null, error: error ?? null };
}

function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    throw e;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const text = readFileOrNull(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  let badLines = 0;
  const lines: LogLine[] = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) lines.push(line);
    else badLines++;
  }

  // Order by instant, not by file order; equal instants keep file order (stable sort).
  lines.sort((a, b) => a.time - b.time);

  const byJob = new Map<string, DigestRow>();
  for (const l of lines) {
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    row.owner = l.owner;
    row.runs++;
    if (l.status === 'retry') row.retries++;
    row.lastStatus = l.status;
    if (l.error !== null) row.lastError = l.error;
    row.lastAt = l.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines } satisfies Night;
};
