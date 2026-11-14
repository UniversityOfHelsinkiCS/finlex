import { query } from '../db.js';

export type UpdatePhase = 'fetch' | 'index' | 'verify' | 'swap' | 'done' | 'failed';
export type UpdateTrigger = 'schedule' | 'manual' | 'rebuild';

export interface UpdateRun {
  id: number;
  scheduled_for: Date;
  trigger: UpdateTrigger;
  start_year: number | null;
  phase: UpdatePhase;
  attempts: number;
  index_suffix: string | null;
  result: Record<string, unknown>;
  owner: string | null;
  heartbeat_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
}

const COLUMNS = 'id, scheduled_for, trigger, start_year, phase, attempts, index_suffix, result, owner, heartbeat_at, started_at, finished_at';

// Creates the run unless one already exists for the same time (a scheduled slot is run only once)
export async function insertRun(scheduledFor: Date, trigger: UpdateTrigger, startYear: number | null, phase: UpdatePhase = 'fetch'): Promise<UpdateRun | null> {
  const { rows } = await query(
    `INSERT INTO update_runs (scheduled_for, trigger, start_year, phase) VALUES ($1, $2, $3, $4)
     ON CONFLICT (scheduled_for) DO NOTHING RETURNING ${COLUMNS}`,
    [scheduledFor, trigger, startYear, phase],
  );
  return rows[0] ?? null;
}

export async function getActiveRun(): Promise<UpdateRun | null> {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM update_runs WHERE phase NOT IN ('done', 'failed') ORDER BY scheduled_for LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function getRun(id: number): Promise<UpdateRun | null> {
  const { rows } = await query(`SELECT ${COLUMNS} FROM update_runs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listRuns(limit = 5): Promise<UpdateRun[]> {
  const { rows } = await query(`SELECT ${COLUMNS} FROM update_runs ORDER BY scheduled_for DESC LIMIT $1`, [limit]);
  return rows;
}

export async function startAttempt(id: number, indexSuffix: string): Promise<UpdateRun> {
  const { rows } = await query(
    `UPDATE update_runs SET attempts = attempts + 1, started_at = COALESCE(started_at, now()),
       heartbeat_at = now(), index_suffix = COALESCE(index_suffix, $2)
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, indexSuffix],
  );
  return rows[0];
}

// result is merged, not replaced
export async function updateRun(id: number, changes: { phase?: UpdatePhase; result?: Record<string, unknown>; finished?: boolean }): Promise<void> {
  await query(
    `UPDATE update_runs SET phase = COALESCE($2, phase), result = result || $3::jsonb, heartbeat_at = now(),
       finished_at = CASE WHEN $4 THEN now() ELSE finished_at END
     WHERE id = $1`,
    [id, changes.phase ?? null, JSON.stringify(changes.result ?? {}), changes.finished ?? false],
  );
}

// A run is leased to one server process at a time. The owner renews the lease every minute;
// a lease not renewed for LEASE_SECONDS (the owner died, e.g. its pod was killed) can be taken over.
export const LEASE_SECONDS = 180;

export async function claimRun(id: number, owner: string): Promise<UpdateRun | null> {
  const { rows } = await query(
    `UPDATE update_runs SET owner = $2, heartbeat_at = now()
     WHERE id = $1 AND phase NOT IN ('done', 'failed')
       AND (owner IS NULL OR owner = $2 OR heartbeat_at < now() - make_interval(secs => $3))
     RETURNING ${COLUMNS}`,
    [id, owner, LEASE_SECONDS],
  );
  return rows[0] ?? null;
}

export async function releaseRun(id: number, owner: string): Promise<void> {
  await query('UPDATE update_runs SET owner = NULL WHERE id = $1 AND owner = $2', [id, owner]);
}

export async function heartbeat(id: number): Promise<void> {
  await query('UPDATE update_runs SET heartbeat_at = now() WHERE id = $1', [id]);
}
