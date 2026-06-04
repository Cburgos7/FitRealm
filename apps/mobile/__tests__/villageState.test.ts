/**
 * villageState.test.ts — VLG-03: Village state machine unit tests
 *
 * Requirement coverage: VLG-03
 *   Village transitions: food >20 = Thriving, food ≤20 = Hungry, food = 0 = Starving
 *
 * The hungry threshold (20) is passed as an argument, not hardcoded in the
 * implementation — INFRA-02 / game_config sourced at runtime.
 */

import { foodToState } from '@/lib/villageState';

const HUNGRY_THRESHOLD = 20; // matches game_config 'food_hungry_threshold' seed value

describe('foodToState — VLG-03 village state machine', () => {
  // ── Thriving boundary ──────────────────────────────────────────────────────

  it('returns thriving when food is above the hungry threshold (food = 21)', () => {
    expect(foodToState(21, HUNGRY_THRESHOLD)).toBe('thriving');
  });

  it('returns thriving at full food (food = 100)', () => {
    expect(foodToState(100, HUNGRY_THRESHOLD)).toBe('thriving');
  });

  it('returns thriving at one above the threshold (food = threshold + 1)', () => {
    expect(foodToState(HUNGRY_THRESHOLD + 1, HUNGRY_THRESHOLD)).toBe('thriving');
  });

  // ── Hungry boundary ───────────────────────────────────────────────────────

  it('returns hungry at exactly the hungry threshold (food = 20)', () => {
    expect(foodToState(20, HUNGRY_THRESHOLD)).toBe('hungry');
  });

  it('returns hungry when food is between 1 and the threshold (food = 10)', () => {
    expect(foodToState(10, HUNGRY_THRESHOLD)).toBe('hungry');
  });

  it('returns hungry at food = 1 (one above starving)', () => {
    expect(foodToState(1, HUNGRY_THRESHOLD)).toBe('hungry');
  });

  // ── Starving boundary ─────────────────────────────────────────────────────

  it('returns starving at exactly 0 food', () => {
    expect(foodToState(0, HUNGRY_THRESHOLD)).toBe('starving');
  });

  it('returns starving for negative food values (clamped by server, but client must handle gracefully)', () => {
    expect(foodToState(-1, HUNGRY_THRESHOLD)).toBe('starving');
  });

  // ── Threshold parameterisation (INFRA-02 guard) ───────────────────────────

  it('respects a custom threshold — food at threshold returns hungry', () => {
    expect(foodToState(50, 50)).toBe('hungry');
  });

  it('respects a custom threshold — food one above threshold returns thriving', () => {
    expect(foodToState(51, 50)).toBe('thriving');
  });

  it('threshold = 0 means only food <= 0 is hungry/starving, food = 1 is thriving', () => {
    expect(foodToState(1, 0)).toBe('thriving');
    expect(foodToState(0, 0)).toBe('starving');
  });
});
