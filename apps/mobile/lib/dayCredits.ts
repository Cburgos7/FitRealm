/**
 * dayCredits.ts — Per-day already-credited miles bookkeeping (D2-06, D2-08)
 *
 * Single source of truth for "how many miles have already been credited today
 * via active GPS sessions". Plan C (02-03) passive gap-fill calls
 * getCreditedToday() before computing its passive delta so GPS session miles
 * are never double-counted (Pitfall 4).
 *
 * Schema:
 *   CREATE TABLE IF NOT EXISTS day_credits (
 *     day TEXT PRIMARY KEY,      -- local-midnight date string, e.g. '2026-06-04'
 *     credited_mi REAL NOT NULL DEFAULT 0
 *   )
 *
 * Day key: local-midnight date string in device timezone (D2-08).
 * Obtain via getTodayKey() exported below.
 *
 * SQLite is opened lazily so the module is also unit-testable with an
 * in-memory mock (see __tests__/dayCredits.test.ts).
 */

import * as SQLite from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Day key helper
// ---------------------------------------------------------------------------

/**
 * Returns the local-midnight date string for the given date (defaults to now).
 * Format: 'YYYY-MM-DD'  (device timezone, matching the platform's "today" concept)
 */
export function getTodayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// SQLite database singleton
// ---------------------------------------------------------------------------

let _db: SQLite.SQLiteDatabase | null = null;

/** @internal — exposed for testing only; do not call outside tests */
export function _injectDatabase(db: SQLite.SQLiteDatabase | null): void {
  _db = db;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('fitrealm_queue.db');
    await _db.execAsync('PRAGMA journal_mode = WAL;');
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Idempotently creates the day_credits table if it does not yet exist.
 * Safe to call multiple times (CREATE TABLE IF NOT EXISTS).
 */
export async function ensureTable(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS day_credits (
      day TEXT PRIMARY KEY,
      credited_mi REAL NOT NULL DEFAULT 0
    );
  `);
}

/**
 * Record that `miles` have been credited for `day`.
 * Uses an UPSERT that INCREMENTS credited_mi so multiple calls on the same
 * day accumulate correctly (e.g., partial banks + session bank both record).
 *
 * @param day   Local-midnight date string, e.g. '2026-06-04'
 * @param miles Miles earned in the session being banked
 */
export async function addCredit(day: string, miles: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO day_credits (day, credited_mi)
     VALUES (?, ?)
     ON CONFLICT(day) DO UPDATE SET credited_mi = credited_mi + excluded.credited_mi`,
    [day, miles],
  );
}

/**
 * Return the total miles already credited for `day`, or 0 if no record exists.
 *
 * @param day   Local-midnight date string, e.g. '2026-06-04'
 */
export async function getCreditedToday(day: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ credited_mi: number }>(
    `SELECT credited_mi FROM day_credits WHERE day = ?`,
    [day],
  );
  return row?.credited_mi ?? 0;
}
