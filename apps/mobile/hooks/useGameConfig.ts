/**
 * useGameConfig.ts — TanStack Query hook for game_config table (INFRA-02)
 *
 * Fetches all game_config rows and returns a key→value map so any component
 * can read balance values without hardcoding numbers.
 *
 * staleTime: 30 minutes — config changes rarely; reduces Supabase reads.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type GameConfigMap = Record<string, string>;

async function fetchGameConfig(): Promise<GameConfigMap> {
  const { data, error } = await supabase
    .from('game_config')
    .select('key, value');

  if (error) throw new Error(error.message);

  const map: GameConfigMap = {};
  for (const row of data ?? []) {
    map[row.key] = row.value;
  }
  return map;
}

const THIRTY_MINUTES = 1000 * 60 * 30;

/**
 * Returns an object with:
 *   - config: GameConfigMap (key → value string)
 *   - isLoading, isError from TanStack Query
 */
export function useGameConfig() {
  return useQuery<GameConfigMap>({
    queryKey: ['game_config'],
    queryFn: fetchGameConfig,
    staleTime: THIRTY_MINUTES,
  });
}
