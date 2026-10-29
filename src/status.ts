import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/readNight.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Per job, by the status of its most recent line (the same status the digest page shows per row).
// ok + retry + fail = number of jobs that ran. `badLines` = lines the reader could not use.
export type NightSummary = { night: string; ok: number; retry: number; fail: number; badLines: number };

export function summarizeNight(runsDir: string, night: string): NightSummary {
  const n = readNight(runsDir, night);
  const s: NightSummary = { night, ok: 0, retry: 0, fail: 0, badLines: n?.badLines ?? 0 };
  for (const row of n?.rows ?? []) s[row.lastStatus]++;
  return s;
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarizeNight(config.runsDir, n)),
  };
}
