/**
 * sqliteQueue.test.ts — ALLOC-04: SQLite offline allocation queue
 *
 * Requirement coverage: ALLOC-04
 *   Offline allocations queued in SQLite; sync on reconnect.
 *   Idempotency key prevents double-spend on rapid taps.
 *
 * Implementation home: apps/mobile/lib/sqliteQueue.ts
 * Implemented in: Plan D (02-04)
 *
 * MISSING — implemented in Plan D
 */

// Placeholder scaffolds — Plan D (02-04) fills these in.
describe('SQLite allocation queue — ALLOC-04', () => {
  it.todo('initQueue creates allocation_queue table if not exists');
  it.todo('enqueueAllocation inserts a pending row');
  it.todo('enqueueAllocation is idempotent — duplicate idempotency_key is ignored');
  it.todo('syncQueue marks successfully synced rows as "synced"');
  it.todo('syncQueue marks server-rejected rows as "rejected"');
  it.todo('syncQueue increments retry_count on transient failure');
  it.todo('pending count exposed for the Mile Bank "pending" badge');
});
