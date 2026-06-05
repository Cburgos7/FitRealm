/**
 * format.ts — shared display formatters (IN-04)
 *
 * formatMiles is the SINGLE source of truth for rendering Mile Bank values.
 * Previously the Village screen's Miles chip rounded to an integer (formatNum)
 * while AllocateSheet showed one decimal (formatMiles), so a user with 1.4 miles
 * saw "1" in the chip but "1.4" in the sheet — confusing when canAfford uses the
 * raw value and a button looks like it should be enabled at "1 mile" but isn't.
 *
 * formatMiles keeps one decimal of precision (the same granularity affordability
 * checks care about) and trims a trailing ".0" so whole values read cleanly.
 * Large values are abbreviated with a "k" suffix.
 */

/**
 * Format a mile value for display. Preserves fractional precision (1 decimal)
 * that affects affordability, so the displayed value never rounds a user across
 * a spend threshold (e.g. 1.4 mi never shows as a misleading "1" next to a
 * disabled spend button).
 */
export function formatMiles(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  const oneDp = n.toFixed(1);
  // Trim a trailing ".0" so whole miles read as "5" not "5.0".
  return oneDp.endsWith('.0') ? oneDp.slice(0, -2) : oneDp;
}

/**
 * Format a non-mile integer resource count (medicine / wood / stone / morale).
 * These are whole-unit resources where fractional precision is not meaningful.
 */
export function formatResource(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
