import { query } from '../db.js';

export interface StatusEntry {
  id: number;
  date: Date;
  data: Record<string, unknown>;
  updating: boolean;
}

export interface StatusCreate {
  data: Record<string, unknown>;
}

export async function createStatusEntry(statusData: StatusCreate): Promise<StatusEntry> {
  const result = await query(
    'INSERT INTO status (data) VALUES ($1) RETURNING id, date, data, updating',
    [JSON.stringify(statusData.data)]
  );

  return {
    id: result.rows[0].id,
    date: result.rows[0].date,
    data: result.rows[0].data,
    updating: result.rows[0].updating
  };
}

export async function getLatestStatusEntry(): Promise<StatusEntry | null> {
  const result = await query(
    'SELECT id, date, data, updating FROM status ORDER BY date DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    date: result.rows[0].date,
    data: result.rows[0].data,
    updating: result.rows[0].updating
  };
}

export async function getAllStatusEntries(limit: number = 50): Promise<StatusEntry[]> {
  const result = await query(
    'SELECT id, date, data, updating FROM status ORDER BY date DESC LIMIT $1',
    [limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    date: row.date,
    data: row.data,
    updating: row.updating
  }));
}

export async function getStatusEntriesByDateRange(startDate: Date, endDate: Date): Promise<StatusEntry[]> {
  const result = await query(
    'SELECT id, date, data, updating FROM status WHERE date >= $1 AND date <= $2 ORDER BY date DESC',
    [startDate, endDate]
  );

  return result.rows.map(row => ({
    id: row.id,
    date: row.date,
    data: row.data,
    updating: row.updating
  }));
}

export async function deleteOldStatusEntries(keepDays: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);

  const result = await query(
    'DELETE FROM status WHERE date < $1',
    [cutoffDate]
  );

  return result.rowCount || 0;
}

export async function clearAllStatusEntries(): Promise<number> {
  const result = await query('DELETE FROM status');
  return result.rowCount || 0;
}
