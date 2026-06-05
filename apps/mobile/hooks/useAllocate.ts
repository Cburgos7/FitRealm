/**
 * useAllocate.ts — allocate miles to a resource (Hunt Food) with optimistic
 * update and offline fallback.
 *
 * Flow:
 *   1. Generate a UUID idempotency key per confirm (T-02D-RPY / T-02D-RACE).
 *   2. Apply optimistic update to Zustand (food += gain, milesBanked -= cost).
 *   3. If online: call supabase.rpc('allocate_food', ...) and on success
 *      invalidate the village query so TanStack Query re-fetches server truth.
 *      On 'insufficient_miles' roll back optimistic state + show an error toast.
 *   4. If offline: enqueueAllocation in SQLite and update pending badge count.
 *
 * Security:
 *   ALLOC-03 — client grey-out is UX only; server rejects over-spend as backstop.
 *   ALLOC-04/T-02D-RPY — UUID idempotency key generated here; same key goes
 *                         to the RPC and the SQLite queue.
 *   ALLOC-05 — server RPC uses FOR UPDATE row lock; this hook can only influence
 *               the client-side optimistic state.
 */

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { foodToState } from '@/lib/villageState';
import { enqueueAllocation, getPendingCount } from '@/lib/sqliteQueue';
import type { SQLiteDatabase } from 'expo-sqlite';

const HUNGRY_THRESHOLD_FALLBACK = 20;

interface AllocateParams {
  /** Miles to deduct from the bank (milesCost × quantity from game_config) */
  milesCost: number;
  /** Food to add to the village (foodGain × quantity from game_config) */
  foodGain: number;
  /** action identifier written to allocations table */
  action?: string;
  /** SQLite DB for offline queue; null skips offline path */
  db: SQLiteDatabase | null;
  /** Hungry threshold from game_config for food_state recompute */
  hungryThreshold?: number;
  /**
   * CR-05: Stable idempotency key for THIS user intent (one per confirm press).
   * The SAME key is threaded through the optimistic online RPC AND the
   * offline-queue enqueue so a retry of the same intent dedupes server-side
   * (allocations.idempotency_key UNIQUE). If omitted, a key is generated once
   * here as a fallback — callers SHOULD pass a stable key (see AllocateSheet).
   */
  idempotencyKey?: string;
}

interface AllocateResult {
  success: boolean;
  /** 'optimistic' = applied locally; 'synced' = server confirmed; 'queued' = offline */
  mode: 'optimistic' | 'synced' | 'queued' | 'error';
  /** Set when the server returned insufficient_miles */
  insufficientMiles?: boolean;
  /** Set when the result was the idempotent server return */
  idempotent?: boolean;
}

/**
 * Returns an `allocate` function the UI can call on each confirm tap.
 * No React state: side effects are Zustand + TanStack Query + SQLite.
 */
export function useAllocate() {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const gameStore = useGameStore();
  // Track in-flight idempotency keys to prevent double-fire from tapping
  const inFlightKeys = useRef(new Set<string>());

  const allocate = useCallback(async (params: AllocateParams): Promise<AllocateResult> => {
    const {
      milesCost,
      foodGain,
      action = 'hunt_food',
      db,
      hungryThreshold = HUNGRY_THRESHOLD_FALLBACK,
      idempotencyKey: providedKey,
    } = params;

    if (!session?.user?.id) {
      return { success: false, mode: 'error' };
    }

    // ── CR-05: stable idempotency key per intent ───────────────────────────
    // Use the caller-provided key (one per confirm press, reused across retries
    // and the offline enqueue) so the server's idempotency_key UNIQUE actually
    // dedupes a re-attempt of the SAME intent. Fall back to a generated key only
    // when the caller did not supply one.
    const idempotencyKey = providedKey ?? generateUUID();

    // Guard against double-fire while THIS intent is in flight. Keying on the
    // stable intent id makes this guard real (previously the per-call fresh UUID
    // was never already present, so the guard was dead).
    if (inFlightKeys.current.has(idempotencyKey)) {
      return { success: false, mode: 'error' };
    }
    inFlightKeys.current.add(idempotencyKey);

    // ── Optimistic update ─────────────────────────────────────────────────
    const prevVillage = gameStore.village;
    if (prevVillage) {
      const newFood = Math.min(
        prevVillage.food + foodGain,
        // We don't have food_cap here; cap is enforced server-side
        // Use a generous local cap that the server will correct on next fetch
        Number.MAX_SAFE_INTEGER
      );
      gameStore.setVillage({
        ...prevVillage,
        food: newFood,
        foodState: foodToState(newFood, hungryThreshold),
        milesBanked: Math.max(0, prevVillage.milesBanked - milesCost),
      });
    }

    try {
      // ── Network check ─────────────────────────────────────────────────
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected && netState.isInternetReachable !== false;

      if (isOnline) {
        // ── Online path: call the RPC ────────────────────────────────────
        const { data, error } = await supabase.rpc('allocate_food', {
          p_user_id:         session.user.id,
          p_miles_cost:      milesCost,
          p_food_gain:       foodGain,
          p_idempotency_key: idempotencyKey,
        });

        if (error) {
          // Transport error — roll back optimistic update
          if (prevVillage) gameStore.setVillage(prevVillage);
          inFlightKeys.current.delete(idempotencyKey);
          return { success: false, mode: 'error' };
        }

        if (data?.success === false && data?.error === 'insufficient_miles') {
          // Server authoritative rejection — roll back
          if (prevVillage) gameStore.setVillage(prevVillage);
          inFlightKeys.current.delete(idempotencyKey);
          return { success: false, mode: 'error', insufficientMiles: true };
        }

        // Success — invalidate so TanStack Query re-fetches server truth
        queryClient.invalidateQueries({ queryKey: ['village', session.user.id] });
        inFlightKeys.current.delete(idempotencyKey);
        return {
          success: true,
          mode: 'synced',
          idempotent: data?.idempotent === true,
        };
      } else {
        // ── Offline path: enqueue ────────────────────────────────────────
        if (db) {
          await enqueueAllocation(db, idempotencyKey, action, milesCost, foodGain);
          const pending = await getPendingCount(db);
          gameStore.setPendingAllocations(pending);
        }
        inFlightKeys.current.delete(idempotencyKey);
        return { success: true, mode: 'queued' };
      }
    } catch {
      // Unexpected exception — roll back optimistic update
      if (prevVillage) gameStore.setVillage(prevVillage);
      inFlightKeys.current.delete(idempotencyKey);
      return { success: false, mode: 'error' };
    }
  }, [session, queryClient, gameStore]);

  return { allocate };
}

// ─── UUID helper ─────────────────────────────────────────────────────────────

/**
 * CR-05: Generate a stable idempotency key for one allocation intent.
 * Callers (e.g. AllocateSheet) create this ONCE per confirm press and reuse it
 * across retries + the offline enqueue so the server dedupes re-attempts of the
 * same intent. Exported so the key is generated with the same scheme used here.
 */
export function generateIdempotencyKey(): string {
  return generateUUID();
}

/**
 * RFC-4122 v4 UUID.  Uses Math.random() — acceptable for idempotency keys
 * (collision probability ≈ 1 in 10^38; not a security primitive here).
 * crypto.randomUUID() would be ideal but is not available in all RN envs.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
