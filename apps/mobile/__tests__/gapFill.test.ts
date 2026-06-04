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
 * Implementation home: apps/mobile/lib/gapFill.ts
 * Implemented in: Plan C (02-03)
 *
 * MISSING — implemented in Plan C
 */

// Placeholder scaffolds — Plan C (02-03) fills these in.
describe('computePassiveDelta — MOV-06/07/12', () => {
  it.todo('returns 0 when health distance equals credited session distance');
  it.todo('returns positive delta when health distance exceeds credited sessions');
  it.todo('floors at 0 when session distance exceeds health total (no negative miles)');
  it.todo('handles multiple sessions credited in the same day');
  it.todo('passive delta does NOT automatically convert to food (stays as miles)');
});
