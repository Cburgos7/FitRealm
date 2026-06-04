/**
 * activityDetector.test.ts — MOV-04: Activity type auto-detection
 *
 * Requirement coverage: MOV-04
 *   Auto-detect activity type from pace + elevation/GPS signals; multipliers applied at banking.
 *   Walking 1.0×, running 1.25×, cycling 1.25×, hiking 1.5×.
 *
 * Implementation home: apps/mobile/lib/activityDetector.ts
 */

import { detectActivityType, ActivityDetectorConfig } from '../lib/activityDetector';

/** game_config seed values (mirrors migration seed in 02-01) */
const DEFAULT_CONFIG: ActivityDetectorConfig = {
  pace_cycle_threshold_mph: '12',
  pace_run_threshold_mpm: '12',
  elevation_hike_gain_m: '50',
  multiplier_walking: '1.0',
  multiplier_running: '1.25',
  multiplier_cycling: '1.25',
  multiplier_hiking: '1.5',
};

describe('detectActivityType — MOV-04', () => {
  it('slow pace (>12 min/mile) with no elevation gain → walking (1.0×)', () => {
    const result = detectActivityType(2.5, 24, 0, DEFAULT_CONFIG);
    expect(result.kind).toBe('walking');
    expect(result.multiplier).toBe(1.0);
  });

  it('boundary: exactly 12 min/mile pace → running (1.25×)', () => {
    // pace_run_threshold_mpm = 12 means ≤ 12 → running
    const result = detectActivityType(5, 12, 0, DEFAULT_CONFIG);
    expect(result.kind).toBe('running');
    expect(result.multiplier).toBe(1.25);
  });

  it('fast pace (< 12 min/mile) → running (1.25×)', () => {
    const result = detectActivityType(7, 8.5, 0, DEFAULT_CONFIG);
    expect(result.kind).toBe('running');
    expect(result.multiplier).toBe(1.25);
  });

  it('sustained high speed (≥12 mph) → cycling (1.25×)', () => {
    const result = detectActivityType(15, 4, 5, DEFAULT_CONFIG);
    expect(result.kind).toBe('cycling');
    expect(result.multiplier).toBe(1.25);
  });

  it('boundary: exactly 12 mph → cycling', () => {
    const result = detectActivityType(12, 5, 0, DEFAULT_CONFIG);
    expect(result.kind).toBe('cycling');
    expect(result.multiplier).toBe(1.25);
  });

  it('slow pace + elevation gain ≥50m/km → hiking (1.5×)', () => {
    const result = detectActivityType(3, 20, 60, DEFAULT_CONFIG);
    expect(result.kind).toBe('hiking');
    expect(result.multiplier).toBe(1.5);
  });

  it('cycling takes priority over hiking (high speed + elevation)', () => {
    const result = detectActivityType(14, 4.3, 80, DEFAULT_CONFIG);
    expect(result.kind).toBe('cycling');
  });

  it('multiplier is read from config, not hardcoded — custom config respected', () => {
    const customConfig: ActivityDetectorConfig = {
      ...DEFAULT_CONFIG,
      multiplier_walking: '2.0',
      multiplier_running: '3.0',
      multiplier_cycling: '2.5',
      multiplier_hiking: '4.0',
    };

    expect(detectActivityType(2, 30, 0, customConfig).multiplier).toBe(2.0);
    expect(detectActivityType(6, 10, 0, customConfig).multiplier).toBe(3.0);
    expect(detectActivityType(15, 4, 0, customConfig).multiplier).toBe(2.5);
    expect(detectActivityType(2, 25, 70, customConfig).multiplier).toBe(4.0);
  });

  it('thresholds are read from config, not hardcoded — custom thresholds respected', () => {
    const customConfig: ActivityDetectorConfig = {
      ...DEFAULT_CONFIG,
      pace_cycle_threshold_mph: '20', // only flag cycling above 20 mph
      pace_run_threshold_mpm: '8',    // only flag running at ≤8 min/mile
      elevation_hike_gain_m: '100',   // only flag hiking at ≥100 m/km
    };

    // 15 mph is below 20 → not cycling; 6 min/mile is below 8 → running
    expect(detectActivityType(15, 6, 0, customConfig).kind).toBe('running');

    // 7 min/mile > 8 threshold → not running; 0 elev → walking
    expect(detectActivityType(5, 9, 0, customConfig).kind).toBe('walking');

    // 80 m/km < 100 threshold → not hiking → walking (slow)
    expect(detectActivityType(2, 25, 80, customConfig).kind).toBe('walking');
  });

  it('paceMinPerMile of 0 (no distance) does not trigger running', () => {
    // Edge case: stationary or very first data point
    const result = detectActivityType(0, 0, 0, DEFAULT_CONFIG);
    expect(result.kind).toBe('walking');
  });
});
