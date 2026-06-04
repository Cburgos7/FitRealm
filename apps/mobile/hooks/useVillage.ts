/**
 * useVillage.ts — TanStack Query hook: fetch/auto-create the authenticated user's village
 *
 * On first authenticated load with no village row, inserts a default village
 * named "Thornhaven" (food=100, grace defaults from schema) then returns it.
 * (D2-35 auto-create — Phase 4 onboarding will replace this.)
 *
 * Joins profiles.miles_banked for the Mile Bank display (VLG-02).
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore, VillageSnapshot } from '@/store/useGameStore';
import { foodToState } from '@/lib/villageState';

const DEFAULT_HUNGRY_THRESHOLD = 20; // fallback until game_config loads

interface VillageRow {
  id: string;
  name: string;
  food: number;
  food_state: string;
  medicine: number;
  wood: number;
  stone: number;
  morale: number;
  grace_expires_at: string | null;
}

interface ProfileRow {
  miles_banked: number;
}

interface VillageWithMiles extends VillageRow {
  milesBanked: number;
}

async function fetchOrCreateVillage(userId: string): Promise<VillageWithMiles> {
  // 1. Fetch the owner's village (joined with profile for miles_banked)
  const { data: villages, error: fetchError } = await supabase
    .from('villages')
    .select('id, name, food, food_state, medicine, wood, stone, morale, grace_expires_at')
    .eq('owner_id', userId)
    .limit(1);

  if (fetchError) throw new Error(fetchError.message);

  let village: VillageRow | null = villages && villages.length > 0 ? villages[0] : null;

  // 2. Auto-create Thornhaven if no village exists (D2-35)
  if (!village) {
    const { data: inserted, error: insertError } = await supabase
      .from('villages')
      .insert({ name: 'Thornhaven', owner_id: userId })
      .select('id, name, food, food_state, medicine, wood, stone, morale, grace_expires_at')
      .single();

    if (insertError) throw new Error(insertError.message);
    village = inserted;
  }

  // 3. Fetch miles_banked from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('miles_banked')
    .eq('id', userId)
    .single<ProfileRow>();

  if (profileError) throw new Error(profileError.message);

  return {
    ...village,
    milesBanked: profile?.miles_banked ?? 0,
  };
}

/**
 * Returns the authenticated user's village (auto-creates Thornhaven if absent).
 * Syncs the latest snapshot into useGameStore so global UI (recording banner, etc.)
 * can read food/session state without re-fetching.
 */
export function useVillage() {
  const session = useAuthStore((s) => s.session);
  const setVillage = useGameStore((s) => s.setVillage);

  const query = useQuery<VillageWithMiles>({
    queryKey: ['village', session?.user?.id],
    queryFn: () => fetchOrCreateVillage(session!.user.id),
    enabled: !!session?.user?.id,
  });

  // Keep Zustand store in sync with server truth
  useEffect(() => {
    if (!query.data) return;
    const d = query.data;
    const snapshot: VillageSnapshot = {
      id: d.id,
      name: d.name,
      food: d.food,
      foodState: foodToState(d.food, DEFAULT_HUNGRY_THRESHOLD),
      milesBanked: d.milesBanked,
      medicine: d.medicine,
      wood: d.wood,
      stone: d.stone,
      morale: d.morale,
      graceExpiresAt: d.grace_expires_at,
    };
    setVillage(snapshot);
  }, [query.data, setVillage]);

  return query;
}
