/**
 * haversine.test.ts — distance helper + IN-02 noise-segment gate
 */

import { haversineDistance, isNoiseSegment } from '@/lib/haversine';

describe('haversineDistance', () => {
  it('returns ~0 for identical points', () => {
    const p: [number, number] = [-122.4194, 37.7749];
    expect(haversineDistance(p, p)).toBeCloseTo(0, 6);
  });

  it('measures ~111km per degree of latitude (within 1%)', () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 1];
    const d = haversineDistance(a, b);
    // 1° latitude ≈ 111,195 m
    expect(d).toBeGreaterThan(111195 * 0.99);
    expect(d).toBeLessThan(111195 * 1.01);
  });
});

describe('isNoiseSegment (IN-02)', () => {
  const MIN = 4; // metres, matches MIN_SEGMENT_DISTANCE_M in useGpsSession

  it('flags sub-threshold drift as noise', () => {
    expect(isNoiseSegment(0, MIN)).toBe(true);
    expect(isNoiseSegment(1.5, MIN)).toBe(true);
    expect(isNoiseSegment(3.99, MIN)).toBe(true);
  });

  it('accepts movement at or above the threshold', () => {
    expect(isNoiseSegment(4, MIN)).toBe(false);
    expect(isNoiseSegment(10, MIN)).toBe(false);
    expect(isNoiseSegment(100, MIN)).toBe(false);
  });

  it('rejects a real stationary-jitter segment computed via haversine', () => {
    // ~1m of GPS drift at SF latitude — should be classified as noise
    const base: [number, number] = [-122.4194, 37.7749];
    const jitter: [number, number] = [-122.41939, 37.77489];
    const deltaM = haversineDistance(base, jitter);
    expect(deltaM).toBeLessThan(MIN);
    expect(isNoiseSegment(deltaM, MIN)).toBe(true);
  });
});
