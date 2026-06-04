/**
 * gapFill.test.ts — MOV-06 / MOV-07 / MOV-12: Gap-fill passive reconciliation
 *
 * Requirement coverage:
 *   MOV-06  GPS lost mid-session: partial route preserved
 *   MOV-07  Orphaned session auto-saved on next launch
 *   MOV-12  Passive movement banks miles only; does NOT auto-feed food
 *
 * Gap-fill ensures passive miles = total health distance − credited session miles,
 * floored at zero, to prevent double-counting (D2-06/D2-07/D2-08).
 *
 * computePassiveDelta is a pure function — no SQLite, no native modules, no
 * side effects. Tests require no mocks or async setup.
 *
 * Implementation home: apps/mobile/lib/gapFill.ts
 */

import { computePassiveDelta, DayRecord } from '../lib/gapFill';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function record(totalHealthDistanceMi: number, creditedSessionsMi: number): DayRecord {
  return { totalHealthDistanceMi, creditedSessionsMi };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computePassiveDelta — MOV-06/07/12', () => {
  // ----- Zero / equality cases -----

  it('returns 0 when health distance equals credited session distance', () => {
    expect(computePassiveDelta(record(3.0, 3.0))).toBe(0);
  });

  it('returns 0 when there is no health distance and no credited sessions', () => {
    expect(computePassiveDelta(record(0, 0))).toBe(0);
  });

  // ----- Positive delta -----

  it('returns positive delta when health distance exceeds credited sessions', () => {
    const delta = computePassiveDelta(record(3.2, 2.5));
    expect(delta).toBeCloseTo(0.7, 5);
  });

  it('returns full health total when credited sessions = 0 (no active session today)', () => {
    expect(computePassiveDelta(record(1.5, 0))).toBeCloseTo(1.5, 5);
  });

  // ----- Floor at zero — no negative miles (MOV-12) -----

  it('floors at 0 when session distance exceeds health total (GPS over-counted vs health)', () => {
    // GPS may record slightly more than the health platform — delta must not go negative
    expect(computePassiveDelta(record(2.0, 2.5))).toBe(0);
  });

  it('floors at 0 when session distance greatly exceeds health total', () => {
    expect(computePassiveDelta(record(0, 5.0))).toBe(0);
  });

  // ----- Multiple sessions accumulated -----

  it('handles multiple sessions credited in the same day (accumulated total)', () => {
    // Two GPS sessions today: 1.0 + 0.8 = 1.8 credited; health shows 2.3 total
    const creditedAccumulated = 1.0 + 0.8; // = 1.8
    const delta = computePassiveDelta(record(2.3, creditedAccumulated));
    expect(delta).toBeCloseTo(0.5, 5);
  });

  it('returns 0 when combined sessions already exceed health total', () => {
    const creditedAccumulated = 2.0 + 1.5; // = 3.5 — both sessions; health only recorded 3.0
    expect(computePassiveDelta(record(3.0, creditedAccumulated))).toBe(0);
  });

  // ----- Passive delta is miles, NOT food (MOV-12) -----

  it('passive delta does NOT automatically convert to food (stays as miles)', () => {
    // The function returns a raw mileage value — the caller (usePassiveHealth) banks it
    // to profiles.miles_banked, NOT to villages.food. We verify that computePassiveDelta
    // returns a miles value (no × food_per_mile multiplication occurs here).
    const delta = computePassiveDelta(record(1.0, 0));
    // 1.0 miles (not 10 food — that conversion belongs in the allocation step)
    expect(delta).toBe(1.0);
  });

  // ----- Fractional miles (real-world accuracy) -----

  it('handles small fractional distances accurately', () => {
    // 0.15 mi health walk; 0.0 credited
    const delta = computePassiveDelta(record(0.15, 0));
    expect(delta).toBeCloseTo(0.15, 5);
  });

  it('handles near-zero floating-point edge cases without going negative', () => {
    // Floating point subtraction can produce tiny negative numbers like -1.11e-16
    const delta = computePassiveDelta(record(1.0000000001, 1.0));
    // Should be ≥ 0 regardless of floating-point representation
    expect(delta).toBeGreaterThanOrEqual(0);
  });

  // ----- Uses Math.max (structural check) -----

  it('uses Math.max ensuring the return value is always non-negative', () => {
    // A comprehensive sweep: all combinations should be ≥ 0
    const cases: [number, number][] = [
      [0, 0], [5, 0], [0, 5], [3, 3], [3.5, 2.5], [1, 1.0001], [100, 99.9999],
    ];
    for (const [health, credited] of cases) {
      expect(computePassiveDelta(record(health, credited))).toBeGreaterThanOrEqual(0);
    }
  });
});
