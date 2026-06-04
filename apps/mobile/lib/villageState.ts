/**
 * villageState.ts — Pure food→state mapping (VLG-03)
 *
 * The village state machine has three states:
 *   - 'thriving' : food > hungryThreshold
 *   - 'hungry'   : 0 < food <= hungryThreshold (warning visuals, still functional)
 *   - 'starving' : food === 0 (locked — allocations disabled until food restored)
 *
 * All thresholds are passed as arguments so this function is testable without
 * game_config and keeps no hardcoded balance numbers (INFRA-02).
 *
 * Server-only decay invariant: this module only reads food — it never mutates it.
 * Food decay is computed exclusively by the Supabase pg_cron function (VLG-06/CLAUDE.md).
 */

export type VillageState = 'thriving' | 'hungry' | 'starving';

/**
 * Map a food value to its village state.
 *
 * @param food            Current food level (numeric; typically 0–100)
 * @param hungryThreshold Food level at or below which state becomes 'hungry'
 *                        (sourced from game_config key 'food_hungry_threshold')
 * @returns               The current village state string
 */
export function foodToState(food: number, hungryThreshold: number): VillageState {
  if (food <= 0) return 'starving';
  if (food <= hungryThreshold) return 'hungry';
  return 'thriving';
}
