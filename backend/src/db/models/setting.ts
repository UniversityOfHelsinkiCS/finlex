import { query } from '../db.js';

// Small key-value store for settings an admin can change at runtime (e.g. pausing the weekly update)

export async function getSetting<T>(key: string): Promise<T | null> {
  const { rows } = await query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return rows.length > 0 ? (rows[0].value as T) : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}
