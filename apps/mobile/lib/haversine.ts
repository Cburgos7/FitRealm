/**
 * haversine.ts — Great-circle distance between two GPS coordinates
 *
 * Uses the Haversine formula, accurate to within ~0.3% for short distances
 * and well within the 1% requirement at 1° latitude (≈ 111,195 m).
 *
 * Coordinates are in [longitude, latitude] order to match GeoJSON convention
 * used throughout the tracker.
 */

const EARTH_RADIUS_M = 6_371_000; // metres (mean)

/**
 * Returns the distance between two [lon, lat] points in metres.
 *
 * @param a - [longitude, latitude] in decimal degrees
 * @param b - [longitude, latitude] in decimal degrees
 */
export function haversineDistance(
  a: [number, number],
  b: [number, number],
): number {
  const [lonA, latA] = a;
  const [lonB, latB] = b;

  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const aVal =
    sinDLat * sinDLat +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinDLon * sinDLon;

  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));

  return EARTH_RADIUS_M * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * IN-02: returns true when a GPS segment is below the minimum movement
 * threshold and should be treated as noise (drift while standing still),
 * i.e. NOT accumulated into session distance.
 *
 * @param deltaM     Segment length in metres (e.g. from haversineDistance)
 * @param minSegM    Minimum per-segment movement in metres (~3-5m typical)
 */
export function isNoiseSegment(deltaM: number, minSegM: number): boolean {
  return deltaM < minSegM;
}
