/**
 * format.test.ts — IN-04: shared mile/resource formatters
 */

import { formatMiles, formatResource } from '@/lib/format';

describe('formatMiles (IN-04)', () => {
  it('keeps one decimal of fractional precision near spend thresholds', () => {
    // The IN-04 bug: 1.4 mi previously rendered as "1" in the Miles chip while
    // canAfford used the raw 1.4 — formatMiles must preserve the fraction.
    expect(formatMiles(1.4)).toBe('1.4');
    expect(formatMiles(0.9)).toBe('0.9');
    expect(formatMiles(2.5)).toBe('2.5');
  });

  it('trims a trailing .0 for whole miles', () => {
    expect(formatMiles(5)).toBe('5');
    expect(formatMiles(0)).toBe('0');
    expect(formatMiles(100)).toBe('100');
  });

  it('abbreviates thousands with a k suffix', () => {
    expect(formatMiles(1500)).toBe('1.5k');
    expect(formatMiles(1000)).toBe('1.0k');
  });

  it('handles null/undefined/NaN as 0', () => {
    expect(formatMiles(null)).toBe('0');
    expect(formatMiles(undefined)).toBe('0');
    expect(formatMiles(NaN)).toBe('0');
  });

  it('matches what an affordability check would conclude', () => {
    // A user with 1.4 mi can NOT afford a 2-mi hunt: the display (1.4) makes the
    // disabled button self-explanatory rather than looking like "1 >= ... ?".
    const bank = 1.4;
    expect(formatMiles(bank)).toBe('1.4');
    expect(bank >= 2).toBe(false);
  });
});

describe('formatResource (IN-04)', () => {
  it('renders whole-unit counts as integers', () => {
    expect(formatResource(0)).toBe('0');
    expect(formatResource(3)).toBe('3');
    expect(formatResource(2.6)).toBe('3'); // rounded
  });

  it('abbreviates thousands and handles nullish', () => {
    expect(formatResource(2500)).toBe('2.5k');
    expect(formatResource(null)).toBe('0');
    expect(formatResource(undefined)).toBe('0');
  });
});
