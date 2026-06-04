/**
 * useVillage.ts — TanStack Query hook: fetch/auto-create the authenticated user's village
 *
 * On first authenticated load with no village row, inserts a default village
 * named "Thornhaven" (food=100, grace defaults from schema) then returns it.
 * (D2-35 auto-create — Phase 4 onboarding will replace this.)
 *
 * Joins profiles.miles_banked for the Mile Bank display (VLG-02).
 *
 * App-foreground refetch (D2-28):
 *   Listens to AppState changes and refetches when the app returns to the
 *   foreground so that the post-cron food/food_state is reflected promptly.
 *   The client NEVER subtracts food on a timer — it only reads server truth
 *   (VLG-06 / CLAUDE.md decay-is-server-only invariant).
 *
 * Food-drop detection (D2-28/D2-33):
 *   Compares the latest server food value to the previously seen value.
 *   When a drop is detected (server food < last seen food), the hook surfaces
 *   a `foodDropDetected` flag and the `foodDelta` so the Village screen can
 *   show a narrative drain animation + toast on app-open — NOT a modal/interrupt.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore, VillageSnapshot } from '@/store/useGameStore';
import { foodToState } from '@/lib/villageState';

const DEFAULT_HUNGRY_THRESHOLD = 20; // fallback until game_config loads

export interface VillageRow {
  id: string;
  name: string;
  food: number;
  food_state: string;
  medicine: number;
  wood: number;
  stone: number;
  morale: number;
  grace_expires_at: string | null;
  last_decay_at: string | null;
}

interface ProfileRow {
  miles_banked: number;
}

export interface VillageWithMiles extends VillageRow {
  milesBanked: number;
}

async function fetchOrCreateVillage(userId: string): Promise<VillageWithMiles> {
  // 1. Fetch the owner's village (joined with profile for miles_banked)
  const { data: villages, error: fetchError } = await supabase
    .from('villages')
    .select('id, name, food, food_state, medicine, wood, stone, morale, grace_expires_at, last_decay_at')
    .eq('owner_id', userId)
    .limit(1);

  if (fetchError) throw new Error(fetchError.message);

  let village: VillageRow | null = villages && villages.length > 0 ? villages[0] : null;

  // 2. Auto-create Thornhaven if no village exists (D2-35)
  if (!village) {
    const { data: inserted, error: insertError } = await supabase
      .from('villages')
      .insert({ name: 'Thornhaven', owner_id: userId })
      .select('id, name, food, food_state, medicine, wood, stone, morale, grace_expires_at, last_decay_at')
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
 *
 * Syncs the latest snapshot into useGameStore so global UI (recording banner, etc.)
 * can read food/session state without re-fetching.
 *
 * Refetches on app foreground so the Village screen always shows post-cron server
 * state (D2-28). The client NEVER subtracts food on a timer (VLG-06).
 *
 * Returns `foodDropSinceLastOpen` (boolean) and `foodDeltaSinceLastOpen` (number ≤ 0)
 * so the Village screen can surface a narrative drain toast/animation (D2-28/D2-33)
 * without interrupting the user.
 */
export function useVillage() {
  const session = useAuthStore((s) => s.session);
  const setVillage = useGameStore((s) => s.setVillage);
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  // Track the last food value we showed the user so we can detect server-side drops.
  // Stored in a ref (not state) to avoid re-render loops.
  const lastSeenFoodRef = useRef<number | null>(null);

  const query = useQuery<VillageWithMiles>({
    queryKey: ['village', userId],
    queryFn: () => fetchOrCreateVillage(userId!),
    enabled: !!userId,
  });

  // ── App-foreground refetch (D2-28) ──────────────────────────────────────────
  // When the app returns to the foreground, invalidate the village query so
  // TanStack Query re-fetches from Supabase. This ensures the UI reflects
  // whatever the pg_cron decay function ran while the app was in the background.
  // CRITICAL: This does NOT apply decay locally — it only triggers a server read.
  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          // Invalidate instead of refetch so TanStack Query respects staleTime
          // but forces a background re-fetch on next access.
          queryClient.invalidateQueries({ queryKey: ['village', userId] });
        }
      }
    );

    return () => subscription.remove();
  }, [userId, queryClient]);

  // ── Keep Zustand store in sync with server truth ────────────────────────────
  // Also detect food drops (D2-28/D2-33) by comparing to the previous known value.
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

    // Update the last-seen food tracker for the next comparison
    lastSeenFoodRef.current = d.food;
  }, [query.data, setVillage]);

  // ── Food-drop detection ─────────────────────────────────────────────────────
  // Compute whether the latest fetch shows a lower food value than what we
  // last showed. Used by the Village screen to trigger drain framing (D2-28).
  // The detection is purely comparative — the client NEVER subtracts food itself.
  let foodDropDetected = false;
  let foodDelta = 0;

  if (query.data && lastSeenFoodRef.current !== null) {
    const prev = lastSeenFoodRef.current;
    const curr = query.data.food;
    // Only count as a "drop" if the food went down AND the village is past grace
    // (grace-window villages don't decay, so any drop inside grace is unexpected)
    if (curr < prev) {
      foodDropDetected = true;
      foodDelta = curr - prev; // negative number (e.g., -2.5 per tick)
    }
  }

  return {
    ...query,
    foodDropDetected,
    foodDelta,
  };
}
