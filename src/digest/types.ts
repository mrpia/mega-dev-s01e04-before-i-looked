// Plan morning-digest § 1. The contract between the run log reader and every digest view
// (page, JSON, board link). Views depend on this file only, never on how the log is read.

/** Status of one line in `runs/<night>.jsonl`. */
export type JobStatus = 'ok' | 'retry' | 'fail';

/** One row per job for one night. */
export type DigestRow = {
  job: string;
  /**
   * Owner from the job's most recent line. `null` when the log says `null` (or omits it):
   * the reader keeps the row and keeps `null`; views render it as `—` (styleguide).
   */
  owner: string | null;
  /** Number of valid lines for this job. Bad lines are never attributed to a job. */
  runs: number;
  /** Number of lines with status `retry`. */
  retries: number;
  /** Status of the job's most recent line. */
  lastStatus: JobStatus;
  /**
   * Error of the most recent line that has one, even if a later line succeeded
   * (e.g. retry "upstream 503" then ok). `null` when no line for this job had an error.
   */
  lastError: string | null;
  /** `at` of the earliest line, exactly as in the log, offset included. Never converted to UTC. */
  firstAt: string;
  /** `at` of the most recent line, exactly as in the log, offset included. */
  lastAt: string;
};

/**
 * A night that has a file on disk.
 * - normal night: `rows.length > 0`
 * - empty file (or only blank lines): `rows` is `[]` and `badLines` is 0, render "nothing ran"
 */
export type Night = {
  /** `YYYY-MM-DD`, as asked for. */
  night: string;
  /** Sorted by `job` (plain code-unit order, so page and JSON agree). */
  rows: DigestRow[];
  /**
   * Lines that were not valid JSON, or valid JSON but not a valid record (missing or non-string
   * `job` / `at`, unparseable `at`, unknown `status`, `owner` not string/null, `error` not a
   * string). Counted, never thrown. Blank lines are skipped and not counted.
   */
  badLines: number;
  /** Valid lines by status, one count per line (not per job). Bad lines are excluded, see `badLines`. */
  statusCounts: { ok: number; retry: number; fail: number };
};

/**
 * Read `<runsDir>/<night>.jsonl`.
 * Returns `null` when there is no file for that night, or `night` is not `YYYY-MM-DD`
 * (route answers 404). Other I/O errors (permissions, a directory in the way) are thrown.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
