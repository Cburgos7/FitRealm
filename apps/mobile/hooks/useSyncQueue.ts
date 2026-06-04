/**
 * useSyncQueue.ts — subscribe to NetInfo; drain the SQLite outbox on reconnect
 *
 * Behaviour:
 *   • Listens for the offline→online transition (ALLOC-04).
 *   • On reconnect, calls syncQueue() against the Supabase RPC.
 *   • After sync, invalidates the village TanStack Query so the UI reflects
 *     server truth (Pitfall 7 — avoids optimistic vs. server flicker).
 *   • Any row returned as 'rejected' (insufficient_miles) surfaces a toast
 *     so the player knows an offline allocation was refused (D2-39).
 *   • Updates the pending badge count via useGameStore.setPendingAllocations.
 *
 * Mount this hook once at the village screen (or app root) so it is always
 * listening even when the AllocateSheet is closed.
 */

import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { syncQueue, getPendingCount } from '@/lib/sqliteQueue';
import type { SQLiteDatabase } from 'expo-sqlite';

interface UseSyncQueueOptions {
  /** SQLite DB opened by the screen; null = no-op (DB not yet ready) */
  db: SQLiteDatabase | null;
  /** Called for each allocation rejected by the server (insufficient_miles) */
  onRejected?: (count: number) => void;
}

/**
 * Subscribe to network changes.  Drains the SQLite queue whenever the
 * device transitions from offline to online.
 */
export function useSyncQueue({ db, onRejected }: UseSyncQueueOptions): void {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const setPendingAllocations = useGameStore((s) => s.setPendingAllocations);

  // Track previous online state to detect offline→online transitions
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!db || !session?.user?.id) return;

    const userId = session.user.id;

    const unsubscribe = NetInfo.addEventListener(async (state: NetInfoState) => {
      const isNowOnline = state.isConnected === true && state.isInternetReachable !== false;
      const wasOnline = wasOnlineRef.current;

      // Only drain on the offline→online transition
      if (wasOnline === false && isNowOnline) {
        try {
          const { rejected } = await syncQueue(db, supabase, userId);

          // Re-fetch village from server — makes UI reflect authoritative truth
          queryClient.invalidateQueries({ queryKey: ['village', userId] });

          // Update pending badge
          const pendingCount = await getPendingCount(db);
          setPendingAllocations(pendingCount);

          // Surface rejections to the caller (AllocateSheet will toast)
          if (rejected > 0 && onRejected) {
            onRejected(rejected);
          }
        } catch {
          // Sync errors are non-fatal; the queue will retry on the next reconnect
        }
      }

      wasOnlineRef.current = isNowOnline;
    });

    // Initialise wasOnline on mount
    NetInfo.fetch().then((state) => {
      wasOnlineRef.current = state.isConnected === true && state.isInternetReachable !== false;
    });

    return () => {
      unsubscribe();
    };
  }, [db, session, queryClient, setPendingAllocations, onRejected]);
}
