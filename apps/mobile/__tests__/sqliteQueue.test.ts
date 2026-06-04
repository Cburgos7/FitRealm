/**
 * sqliteQueue.test.ts — ALLOC-04: SQLite offline allocation queue
 *
 * Requirement coverage: ALLOC-04
 *   Offline allocations queued in SQLite; sync on reconnect.
 *   Idempotency key prevents double-spend on rapid taps.
 *
 * Implementation: apps/mobile/lib/sqliteQueue.ts
 * Plan: D (02-04)
 */

import {
  initQueue,
  enqueueAllocation,
  syncQueue,
  getPendingCount,
} from '../lib/sqliteQueue';

// expo-sqlite is auto-mocked from __mocks__/expo-sqlite.ts
import * as SQLite from 'expo-sqlite';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock SQLiteDatabase whose behaviour is controllable per test */
function makeMockDb(overrides: Partial<{
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
}> = {}) {
  return {
    execAsync:    overrides.execAsync    ?? jest.fn().mockResolvedValue(undefined),
    runAsync:     overrides.runAsync     ?? jest.fn().mockResolvedValue(undefined),
    getAllAsync:   overrides.getAllAsync  ?? jest.fn().mockResolvedValue([]),
    getFirstAsync: overrides.getFirstAsync ?? jest.fn().mockResolvedValue(null),
  } as unknown as SQLite.SQLiteDatabase;
}

/** Build a minimal Supabase client stub with a controllable rpc() mock */
function makeSupabase(rpcResult: {
  data?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
}) {
  return {
    rpc: jest.fn().mockResolvedValue(rpcResult),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

// ─── initQueue ────────────────────────────────────────────────────────────────

describe('initQueue', () => {
  it('creates allocation_queue table if not exists', async () => {
    const mockDb = makeMockDb();
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValueOnce(mockDb);

    const db = await initQueue();

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('fitrealm_queue.db');
    // WAL pragma call
    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
    // CREATE TABLE call — should contain the schema keyword
    const createCall = (mockDb.execAsync as jest.Mock).mock.calls.find(
      (args: string[]) => args[0]?.includes('CREATE TABLE IF NOT EXISTS allocation_queue')
    );
    expect(createCall).toBeDefined();
    // allocation_queue must have idempotency_key UNIQUE
    expect(createCall![0]).toContain('idempotency_key TEXT    UNIQUE NOT NULL');
    expect(db).toBe(mockDb);
  });
});

// ─── enqueueAllocation ────────────────────────────────────────────────────────

describe('enqueueAllocation', () => {
  it('inserts a pending row with the given fields', async () => {
    const mockDb = makeMockDb();

    await enqueueAllocation(mockDb, 'key-abc-123', 'hunt_food', 3, 30);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = (mockDb.runAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('INSERT OR IGNORE INTO allocation_queue');
    expect(params).toEqual(['key-abc-123', 'hunt_food', 3, 30]);
  });

  it('is idempotent — duplicate idempotency_key is silently ignored (INSERT OR IGNORE)', async () => {
    // Simulate the second INSERT being a no-op (SQLite behaviour for OR IGNORE)
    const mockDb = makeMockDb();

    await enqueueAllocation(mockDb, 'key-dup', 'hunt_food', 1, 10);
    await enqueueAllocation(mockDb, 'key-dup', 'hunt_food', 1, 10); // duplicate

    // Both calls go through but the SQL itself uses INSERT OR IGNORE so
    // the second is silently skipped by SQLite at the DB level.
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    const [sql1] = (mockDb.runAsync as jest.Mock).mock.calls[0];
    const [sql2] = (mockDb.runAsync as jest.Mock).mock.calls[1];
    expect(sql1).toContain('INSERT OR IGNORE');
    expect(sql2).toContain('INSERT OR IGNORE');
  });
});

// ─── syncQueue ────────────────────────────────────────────────────────────────

describe('syncQueue', () => {
  it('marks a successfully synced row as "synced"', async () => {
    const pendingRow = {
      id: 1,
      idempotency_key: 'key-sync-success',
      action: 'hunt_food',
      miles_cost: 1,
      food_gain: 10,
      created_at: '2026-06-04T00:00:00Z',
      status: 'pending',
      retry_count: 0,
    };

    const mockDb = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([pendingRow]),
    });

    const supabase = makeSupabase({ data: { success: true }, error: null });

    const result = await syncQueue(mockDb, supabase, FAKE_USER_ID);

    // RPC called with p_idempotency_key passed through
    expect(supabase.rpc).toHaveBeenCalledWith('allocate_food', {
      p_user_id:         FAKE_USER_ID,
      p_miles_cost:      1,
      p_food_gain:       10,
      p_idempotency_key: 'key-sync-success',
    });

    // Row marked synced
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'synced'"),
      [1]
    );
    expect(result).toEqual({ synced: 1, rejected: 0, retried: 0 });
  });

  it('marks server-rejected rows as "rejected" on insufficient_miles', async () => {
    const pendingRow = {
      id: 2,
      idempotency_key: 'key-insufficient',
      action: 'hunt_food',
      miles_cost: 999,
      food_gain: 9990,
      created_at: '2026-06-04T00:00:00Z',
      status: 'pending',
      retry_count: 0,
    };

    const mockDb = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([pendingRow]),
    });

    const supabase = makeSupabase({
      data: { success: false, error: 'insufficient_miles' },
      error: null,
    });

    const result = await syncQueue(mockDb, supabase, FAKE_USER_ID);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'rejected'"),
      [2]
    );
    expect(result).toEqual({ synced: 0, rejected: 1, retried: 0 });
  });

  it('increments retry_count on transient failure (network error)', async () => {
    const pendingRow = {
      id: 3,
      idempotency_key: 'key-transient',
      action: 'hunt_food',
      miles_cost: 1,
      food_gain: 10,
      created_at: '2026-06-04T00:00:00Z',
      status: 'pending',
      retry_count: 0,
    };

    const mockDb = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([pendingRow]),
    });

    // Supabase returns a transport-level error object
    const supabase = makeSupabase({
      data: null,
      error: { message: 'Network request failed', code: 'PGRST301' },
    });

    const result = await syncQueue(mockDb, supabase, FAKE_USER_ID);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('retry_count = retry_count + 1'),
      [3]
    );
    expect(result).toEqual({ synced: 0, rejected: 0, retried: 1 });
  });

  it('passes p_idempotency_key through to the RPC', async () => {
    const pendingRow = {
      id: 4,
      idempotency_key: 'unique-key-xyz',
      action: 'hunt_food',
      miles_cost: 2,
      food_gain: 20,
      created_at: '2026-06-04T00:00:00Z',
      status: 'pending',
      retry_count: 0,
    };

    const mockDb = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([pendingRow]),
    });

    const supabase = makeSupabase({ data: { success: true }, error: null });

    await syncQueue(mockDb, supabase, FAKE_USER_ID);

    const rpcArgs = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcArgs[0]).toBe('allocate_food');
    expect(rpcArgs[1]).toMatchObject({ p_idempotency_key: 'unique-key-xyz' });
  });

  it('handles an empty pending queue gracefully', async () => {
    const mockDb = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([]),
    });

    const supabase = makeSupabase({ data: { success: true }, error: null });

    const result = await syncQueue(mockDb, supabase, FAKE_USER_ID);

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, rejected: 0, retried: 0 });
  });
});

// ─── getPendingCount ──────────────────────────────────────────────────────────

describe('getPendingCount', () => {
  it('returns the number of pending rows for the Mile Bank badge', async () => {
    const mockDb = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue({ count: 3 }),
    });

    const count = await getPendingCount(mockDb);

    expect(count).toBe(3);
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE  status = 'pending'")
    );
  });

  it('returns 0 when there are no pending rows', async () => {
    const mockDb = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue({ count: 0 }),
    });

    expect(await getPendingCount(mockDb)).toBe(0);
  });

  it('returns 0 when the query returns null (empty table)', async () => {
    const mockDb = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    });

    expect(await getPendingCount(mockDb)).toBe(0);
  });
});
