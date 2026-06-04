/**
 * activityDetector.ts — Auto-detect activity kind from pace + elevation (MOV-04)
 *
 * All thresholds and multipliers are passed in via the config argument so
 * no balance values are hardcoded in comparison logic (INFRA-02).
 *
 * Priority order (highest certainty first):
 *   1. Cycling  — sustained speed ≥ pace_cycle_threshold_mph
 *   2. Hiking   — elevation gain ≥ elevation_hike_gain_m per km
 *   3. Running  — pace ≤ pace_run_threshold_mpm (min/mile)
 *   4. Walking  — fallback
 */

export type ActivityKind = 'walking' | 'running' | 'cycling' | 'hiking';

export interface ActivityDetectorConfig {
  /** Speed in mph at or above which the activity is classified as cycling */
  pace_cycle_threshold_mph: string | number;
  /** Pace in min/mile at or below which the activity is classified as running */
  pace_run_threshold_mpm: string | number;
  /** Elevation gain in metres per km to trigger hiking classification */
  elevation_hike_gain_m: string | number;
  /** Mile multipliers */
  multiplier_walking: string | number;
  multiplier_running: string | number;
  multiplier_cycling: string | number;
  multiplier_hiking: string | number;
}

export interface ActivityResult {
  kind: ActivityKind;
  multiplier: number;
}

/**
 * Detect the activity type and return the appropriate mile multiplier.
 *
 * @param avgSpeedMph        Average speed for the session in mph
 * @param paceMinPerMile     Average pace for the session in min/mile (0 means unknown/stationary)
 * @param elevGainMPerKm     Average elevation gain in metres per km (0 if no elevation data)
 * @param config             game_config map (values come from the server, not hardcoded)
 */
export function detectActivityType(
  avgSpeedMph: number,
  paceMinPerMile: number,
  elevGainMPerKm: number,
  config: ActivityDetectorConfig,
): ActivityResult {
  const cycleThresholdMph = Number(config.pace_cycle_threshold_mph);
  const runThresholdMpm = Number(config.pace_run_threshold_mpm);
  const hikeGainMPerKm = Number(config.elevation_hike_gain_m);

  const mCycling = Number(config.multiplier_cycling);
  const mRunning = Number(config.multiplier_running);
  const mHiking = Number(config.multiplier_hiking);
  const mWalking = Number(config.multiplier_walking);

  // Cycling: sustained speed is the clearest signal
  if (avgSpeedMph >= cycleThresholdMph) {
    return { kind: 'cycling', multiplier: mCycling };
  }

  // Hiking: slow movement WITH significant elevation gain
  if (elevGainMPerKm >= hikeGainMPerKm) {
    return { kind: 'hiking', multiplier: mHiking };
  }

  // Running: pace at or below the run threshold (lower min/mile = faster)
  if (paceMinPerMile > 0 && paceMinPerMile <= runThresholdMpm) {
    return { kind: 'running', multiplier: mRunning };
  }

  // Default: walking
  return { kind: 'walking', multiplier: mWalking };
}
