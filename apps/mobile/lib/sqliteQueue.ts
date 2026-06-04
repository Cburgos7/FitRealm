/**
 * sqliteQueue.ts — expo-sqlite offline allocation outbox (ALLOC-04)
 *
 * Implements a local SQLite queue for allocation intents that couldn't be
 * sent to Supabase because the device was offline.  On reconnect,
 * useSyncQueue drains the queue by calling syncQueue().
 *
 * Security invariants:
 *   ALLOC-04/T-02D-RPY  — INSERT OR IGNORE on idempotency_key UNIQUE
 *                          prevents duplicate spend if the same key is
 *                          enqueued more than once (rapid tap, re-sync).
 *   ALLOC-05             — syncQueue passes p_idempotency_key to the RPC;
 *                          the server also checks uniqueness under a row lock.
 *
 * Status machine:
 *   'pending'  — waiting to be sent
 *   'synced'   — RPC returned success
 *   'rejected' — RPC returned { success: false, error: 'insufficient_miles' }
 *                (server-authoritative; caller must roll back optimistic state)
 *   (no status update on transient error — retry_count is incremented instead)
 */

import * as SQLite from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

const DB_NAME = 'fitrealm_queue.db';

export interface AllocationQueueRow {
  id: number;
  idempotency_key: string;
  action: string;
  miles_cost: number;
  food_gain: number;
  created_at: string;
  status: 'pending' | 'synced' | 'rejected';
  retry_count: number;
}

// ─── Database initialisation ──────────────────────────────────────────────────

/**
 * Open (or create) the SQLite database and ensure the allocation_queue table
 * and its status index exist.  Call once on app start before enqueue/sync.
 *
 * WAL mode is enabled so reads and writes do not block each other.
 */
export async function initQueue(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS allocation_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT    UNIQUE NOT NULL,
      action          TEXT    NOT NULL,
      miles_cost      REAL    NOT NULL,
      food_gain       REAL    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      status          TEXT    NOT NULL DEFAULT 'pending',
      retry_count     INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status
      ON allocation_queue (status);
  `);

  return db;
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

/**
 * Add an allocation intent to the queue.
 *
 * INSERT OR IGNORE: if this idempotency_key already exists (e.g. rapid
 * double-tap generating the same UUID before the first call resolves) the
 * row is silently skipped — no duplicate spend.
 */
export async function enqueueAllocation(
  db: SQLite.SQLiteDatabase,
  idempotencyKey: string,
  action: string,
  milesCost: number,
  foodGain: number
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO allocation_queue
       (idempotency_key, action, miles_cost, food_gain)
     VALUES (?, ?, ?, ?)`,
    [idempotencyKey, action, milesCost, foodGain]
  );
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Drain the pending queue by replaying each row against the Supabase RPC.
 *
 * Outcomes:
 *   • RPC success         → mark row 'synced'
 *   • insufficient_miles  → mark row 'rejected' (caller should toast + re-sync UI)
 *   • any other error     → increment retry_count (transient; will retry next sync)
 *
 * The batch size is capped at 20 to limit one sync burst.
 */
export async function syncQueue(
  db: SQLite.SQLiteDatabase,
  supabase: SupabaseClient,
  userId: string
): Promise<{ synced: number; rejected: number; retried: number }> {
  const pending = await db.getAllAsync<AllocationQueueRow>(
    `SELECT * FROM allocation_queue
     WHERE  status = 'pending'
     ORDER  BY id ASC
     LIMIT  20`
  );

  let synced = 0;
  let rejected = 0;
  let retried = 0;

  for (const row of pending) {
    try {
      const { data, error } = await supabase.rpc('allocate_food', {
        p_user_id:         userId,
        p_miles_cost:      row.miles_cost,
        p_food_gain:       row.food_gain,
        p_idempotency_key: row.idempotency_key,
      });

      if (error) {
        // Network/transport error — transient; increment retry_count
        await db.runAsync(
          `UPDATE allocation_queue
           SET    retry_count = retry_count + 1
           WHERE  id = ?`,
          [row.id]
        );
        retried++;
      } else if (data?.success === true) {
        await db.runAsync(
          `UPDATE allocation_queue SET status = 'synced' WHERE id = ?`,
          [row.id]
        );
        synced++;
      } else if (data?.error === 'insufficient_miles') {
        await db.runAsync(
          `UPDATE allocation_queue SET status = 'rejected' WHERE id = ?`,
          [row.id]
        );
        rejected++;
      } else {
        // Unexpected server response — treat as transient
        await db.runAsync(
          `UPDATE allocation_queue
           SET    retry_count = retry_count + 1
           WHERE  id = ?`,
          [row.id]
        );
        retried++;
      }
    } catch {
      // JS exception (e.g. JSON parse failure) — treat as transient
      await db.runAsync(
        `UPDATE allocation_queue
         SET    retry_count = retry_count + 1
         WHERE  id = ?`,
        [row.id]
      );
      retried++;
    }
  }

  return { synced, rejected, retried };
}

// ─── Pending count ────────────────────────────────────────────────────────────

/**
 * Returns the number of pending (not yet synced) rows.
 * Drives the PendingBadge component near the Mile Bank (D2-38).
 */
export async function getPendingCount(db: SQLite.SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM   allocation_queue
     WHERE  status = 'pending'`
  );
  return result?.count ?? 0;
}
