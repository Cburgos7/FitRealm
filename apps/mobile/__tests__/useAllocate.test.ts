/**
 * useAllocate.test.ts — CR-05: stable idempotency key per allocation intent
 *
 * Full hook behaviour (NetInfo + Supabase RPC + SQLite) is exercised on device;
 * here we cover the pure, unit-testable contract that CR-05 hardens:
 *   1. generateIdempotencyKey() returns RFC-4122 v4 UUIDs.
 *   2. Distinct calls return distinct keys (so a genuinely new intent is not
 *      accidentally deduped).
 *   3. The intent-key reuse pattern AllocateSheet uses (one key per
 *      action+quantity signature, reused until the signature changes) yields a
 *      STABLE key across retries of the same intent and a FRESH key when the
 *      intent changes — which is what makes the server idempotency_key UNIQUE
 *      actually dedupe a retry instead of double-spending.
 */

// useAllocate imports native-only modules at module load (NetInfo, supabase,
// expo-sqlite types). We only exercise the pure generateIdempotencyKey export,
// so stub the native deps to keep the import graph loadable under Jest.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));
// IN-01: expo-crypto's native module isn't resolvable under Jest. Mock
// randomUUID with Node's crypto.randomUUID (also a CSPRNG-backed RFC-4122 v4),
// so the format + uniqueness contract is still exercised here.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/sqliteQueue', () => ({
  enqueueAllocation: jest.fn(),
  getPendingCount: jest.fn(),
}));

import { generateIdempotencyKey } from '../hooks/useAllocate';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('useAllocate — CR-05 idempotency keys', () => {
  it('generateIdempotencyKey returns an RFC-4122 v4 UUID', () => {
    expect(generateIdempotencyKey()).toMatch(UUID_V4);
  });

  it('successive keys are distinct', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });

  it('intent-key reuse: same signature reuses the key, changed signature mints a new one', () => {
    // Mirrors AllocateSheet.getIntentKey: one key per signature, reused until
    // the signature changes or the intent is retired.
    let intent: { signature: string; key: string } | null = null;
    const getIntentKey = (signature: string): string => {
      if (!intent || intent.signature !== signature) {
        intent = { signature, key: generateIdempotencyKey() };
      }
      return intent.key;
    };

    // Same intent (retry after a transport error) → SAME key (server dedupes).
    const k1 = getIntentKey('hunt_food:2');
    const k2 = getIntentKey('hunt_food:2');
    expect(k2).toBe(k1);

    // Intent changes (quantity edited) → FRESH key (distinct real spend).
    const k3 = getIntentKey('hunt_food:3');
    expect(k3).not.toBe(k1);

    // Retire the intent (success) → next attempt of the original gets a new key.
    intent = null;
    const k4 = getIntentKey('hunt_food:2');
    expect(k4).not.toBe(k1);
  });
});
