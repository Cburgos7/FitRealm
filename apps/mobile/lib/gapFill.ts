/**
 * gapFill.ts — Passive gap-fill reconciliation (D2-06, D2-07, D2-08, MOV-09)
 *
 * Computes the passive delta: total movement recorded by the health platform
 * (HealthKit / Health Connect) minus the distance already credited via active
 * GPS or manual sessions today, floored at zero.
 *
 * Why floored at zero:
 *   - A GPS session may record slightly MORE distance than the health platform
 *     for the same movement (different sensors/algorithms).
 *   - We NEVER award negative miles; if the active sessions already exceed the
 *     health total, passive delta = 0 (MOV-12 — no double-count).
 *
 * Dependency on Plan B (02-02):
 *   The `creditedSessionsMi` value that callers pass in is obtained by:
 *     import { getCreditedToday } from '@/lib/dayCredits';
 *     const credited = await getCreditedToday(todayKey);
 *   This module intentionally does NOT import dayCredits or touch SQLite —
 *   it is a pure function. The hook (usePassiveHealth) owns the DB read.
 *
 * Usage:
 *   const delta = computePassiveDelta({
 *     totalHealthDistanceMi: 3.2,    // from HealthKit / Health Connect today
 *     creditedSessionsMi: 2.5,       // from dayCredits.getCreditedToday(today)
 *   });
 *   // → 0.7  (passive miles to offer the user)
 */

export interface DayRecord {
  /** Total distance reported by the health platform for today, in miles */
  totalHealthDistanceMi: number;
  /**
   * Sum of all active-session miles already credited today (GPS + manual),
   * read from the day_credits SQLite table owned by Plan B (02-02).
   */
  creditedSessionsMi: number;
}

/**
 * Returns the passive distance delta for today, in miles.
 *
 * delta = max(0, totalHealthDistanceMi − creditedSessionsMi)
 *
 * @param record  Day record with health total and already-credited sessions
 * @returns       Miles available to bank as passive (≥ 0, never negative)
 */
export function computePassiveDelta(record: DayRecord): number {
  return Math.max(0, record.totalHealthDistanceMi - record.creditedSessionsMi);
}
