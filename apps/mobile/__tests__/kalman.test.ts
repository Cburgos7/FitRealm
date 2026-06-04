/**
 * kalman.test.ts — MOV-02: Kalman filter GPS smoothing
 *
 * Requirement coverage: MOV-02
 *   GPS Kalman filter; >20m accuracy discarded; filter smooths noisy coordinates
 *
 * Implementation home: apps/mobile/lib/kalman.ts
 */

import { KalmanFilter } from '../lib/kalman';

const DEFAULT_CONFIG = {
  Q: 0.00001,
  R: 0.0001,
};

// Deterministic PRNG (mulberry32) so noise sequences are reproducible —
// avoids intermittent failures from Math.random() against tight thresholds.
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('KalmanFilter — MOV-02', () => {
  it('smooths a noisy constant signal toward the true value', () => {
    const filter = new KalmanFilter(DEFAULT_CONFIG);
    const TRUE_VALUE = 51.5074; // lat of London

    // Seed with the true value
    filter.reset(TRUE_VALUE);

    // Feed 50 noisy measurements (±0.01 noise) — deterministic seed
    const rand = seededRandom(12345);
    const noisy = Array.from({ length: 50 }, () => TRUE_VALUE + (rand() - 0.5) * 0.02);
    let estimate = TRUE_VALUE;
    for (const m of noisy) {
      estimate = filter.filter(m);
    }

    // After convergence the estimate should be very close to the true value
    expect(Math.abs(estimate - TRUE_VALUE)).toBeLessThan(0.005);
  });

  it('output variance is less than input variance over a noisy sequence', () => {
    const filter = new KalmanFilter(DEFAULT_CONFIG);
    const TRUE_VALUE = 0.0;
    filter.reset(TRUE_VALUE);

    const rand = seededRandom(67890);
    const measurements = Array.from({ length: 100 }, () => TRUE_VALUE + (rand() - 0.5) * 0.1);
    const filtered = measurements.map(m => filter.filter(m));

    const inputVariance = variance(measurements);
    const outputVariance = variance(filtered);

    expect(outputVariance).toBeLessThan(inputVariance);
  });

  it('reset() re-initialises state to a new initial value', () => {
    const filter = new KalmanFilter(DEFAULT_CONFIG);
    filter.reset(10);
    filter.filter(10.5);
    filter.filter(11);

    // Reset to a completely different value
    filter.reset(50);
    expect(filter.value).toBe(50);

    // After reset the filter should follow the new value, not bleed toward old
    const result = filter.filter(50.001);
    expect(Math.abs(result - 50)).toBeLessThan(0.01);
  });

  it('consecutive identical readings converge Kalman gain toward steady-state (non-increasing)', () => {
    const filter = new KalmanFilter(DEFAULT_CONFIG);
    filter.reset(1.0);

    // Capture gain trajectory
    const gains: number[] = [];
    for (let i = 0; i < 200; i++) {
      filter.filter(1.0);
      gains.push(filter.lastGain);
    }

    // The gain must converge — later gains should not exceed early gains
    const earlyGain = gains[0];
    const lateGain = gains[gains.length - 1];
    expect(lateGain).toBeLessThan(earlyGain);

    // After many identical readings the estimate must not drift from initial
    expect(Math.abs(filter.value - 1.0)).toBeLessThan(0.0001);
  });

  it('process noise Q from game_config affects convergence speed', () => {
    // Higher Q → filter adapts faster (larger gain)
    const fastFilter = new KalmanFilter({ Q: 0.01, R: 0.0001 });
    const slowFilter = new KalmanFilter({ Q: 0.000001, R: 0.0001 });

    fastFilter.reset(0);
    slowFilter.reset(0);

    // Feed a step change
    for (let i = 0; i < 10; i++) {
      fastFilter.filter(100);
      slowFilter.filter(100);
    }

    // Fast filter should have moved further toward the new value
    expect(fastFilter.value).toBeGreaterThan(slowFilter.value);
  });

  it('haversine: 1 degree latitude ≈ 111,195 m (within 1%)', () => {
    // This test lives here for convenience since it validates a core formula
    // used by the GPS session.  Haversine module test lives in its own suite.
    const { haversineDistance } = require('../lib/haversine');
    const pointA: [number, number] = [0, 0];
    const pointB: [number, number] = [0, 1]; // 1 degree north

    const dist = haversineDistance(pointA, pointB);
    const EXPECTED = 111_195;
    const tolerance = EXPECTED * 0.01; // 1%

    expect(Math.abs(dist - EXPECTED)).toBeLessThan(tolerance);
  });
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.map(v => (v - mean) ** 2);
  return sq.reduce((a, b) => a + b, 0) / values.length;
}
