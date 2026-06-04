/**
 * activityDetector.test.ts — MOV-04: Activity type auto-detection
 *
 * Requirement coverage: MOV-04
 *   Auto-detect activity type from pace + elevation/GPS signals; multipliers applied at banking.
 *   Walking 1.0×, running 1.25×, cycling 1.25×, hiking 1.5×.
 *
 * Implementation home: apps/mobile/lib/activityDetector.ts
 * Implemented in: Plan B (02-02)
 *
 * MISSING — implemented in Plan B
 */

// Placeholder scaffolds — Plan B (02-02) fills these in.
describe('detectActivityType — MOV-04', () => {
  it.todo('slow pace (>12 min/mile) with no elevation gain → walking (1.0×)');
  it.todo('fast pace (≤12 min/mile) → running (1.25×)');
  it.todo('sustained high speed (≥12 mph) → cycling (1.25×)');
  it.todo('slow pace + elevation gain ≥50m/km → hiking (1.5×)');
  it.todo('multiplier is read from game_config thresholds, not hardcoded');
});
