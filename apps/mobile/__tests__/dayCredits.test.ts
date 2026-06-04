/**
 * dayCredits.test.ts — Per-day credited miles bookkeeping (D2-06, D2-08)
 *
 * Tests the day_credits SQLite table logic in isolation using an in-memory
 * database mock so no native modules are required.
 *
 * Covers:
 *   - getCreditedToday returns 0 for an unseen day
 *   - addCredit accumulates on the same day (two calls sum)
 *   - Different day key starts fresh at 0
 *   - ensureTable is idempotent (safe to call twice)
 *   - getTodayKey returns correct YYYY-MM-DD format
 */

import {
  ensureTable,
  addCredit,
  getCreditedToday,
  getTodayKey,
  _injectDatabase,
} from '../lib/dayCredits';

// ---------------------------------------------------------------------------
// In-memory SQLite mock
// ---------------------------------------------------------------------------

/** Simple in-memory store that mimics the subset of expo-sqlite API we use. */
function createInMemoryDb() {
  const store: Record<string, number> = {};
  let tableCreated = false;

  return {
    _store: store,
    async execAsync(sql: string) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS day_credits')) {
        tableCreated = true;
      }
      // WAL pragma is a no-op in the mock
    },
    async runAsync(sql: string, params: unknown[]) {
      if (!tableCreated) throw new Error('Table not created');
      const [day, miles] = params as [string, number];
      if (sql.includes('ON CONFLICT')) {
        // UPSERT: increment if exists, insert if not
        store[day] = (store[day] ?? 0) + miles;
      }
    },
    async getFirstAsync<T>(sql: string, params: unknown[]): Promise<T | null> {
      if (!tableCreated) throw new Error('Table not created');
      const [day] = params as [string];
      const val = store[day];
      if (val === undefined) return null;
      return { credited_mi: val } as unknown as T;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dayCredits — D2-06/D2-08', () => {
  beforeEach(async () => {
    // Inject a fresh in-memory mock before each test
    const db = createInMemoryDb() as unknown as import('expo-sqlite').SQLiteDatabase;
    _injectDatabase(db);
    // Call ensureTable on the fresh mock so tableCreated flag is set
    await ensureTable();
  });

  afterAll(() => {
    // Clean up injection so other test suites get the real module
    _injectDatabase(null);
  });

  it('getCreditedToday returns 0 for an unseen day', async () => {
    const result = await getCreditedToday('2026-01-01');
    expect(result).toBe(0);
  });

  it('addCredit records miles for the day', async () => {
    await addCredit('2026-06-04', 3.5);
    const result = await getCreditedToday('2026-06-04');
    expect(result).toBe(3.5);
  });

  it('addCredit accumulates — two calls on the same day sum', async () => {
    await addCredit('2026-06-04', 2.0);
    await addCredit('2026-06-04', 1.5);
    const result = await getCreditedToday('2026-06-04');
    expect(result).toBeCloseTo(3.5, 5);
  });

  it('different day key starts fresh at 0', async () => {
    await addCredit('2026-06-04', 5.0);

    const today = await getCreditedToday('2026-06-04');
    const tomorrow = await getCreditedToday('2026-06-05');

    expect(today).toBe(5.0);
    expect(tomorrow).toBe(0); // different day — no carryover
  });

  it('ensureTable is idempotent — calling twice does not throw', async () => {
    await expect(ensureTable()).resolves.not.toThrow();
  });

  it('getTodayKey returns YYYY-MM-DD format', () => {
    const key = getTodayKey(new Date(2026, 5, 4)); // June 4, 2026 (month is 0-indexed)
    expect(key).toBe('2026-06-04');
  });

  it('getTodayKey pads single-digit month and day', () => {
    const key = getTodayKey(new Date(2026, 0, 9)); // Jan 9, 2026
    expect(key).toBe('2026-01-09');
  });

  it('addCredit with partial miles also accumulates (partial bank scenario)', async () => {
    // Simulate orphan recovery + session bank both calling addCredit
    await addCredit('2026-06-04', 0.5);  // partial orphan recovery
    await addCredit('2026-06-04', 2.3);  // full session bank
    const result = await getCreditedToday('2026-06-04');
    expect(result).toBeCloseTo(2.8, 5);
  });
});
