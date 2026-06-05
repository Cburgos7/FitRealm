/**
 * useGameStore.ts — Zustand village / game session state (mirrors useAuthStore)
 *
 * Holds a lightweight snapshot of village state so components can read food,
 * miles, and session status without re-fetching the full TanStack Query every
 * render. Server truth always wins: TanStack Query mutations update this store
 * after every successful RPC call.
 *
 * isSessionActive: set to true by Plan B (useGpsSession) when a GPS session is
 * recording; false here keeps the recording banner hidden on this plan.
 */

import { create } from 'zustand';
import { VillageState } from '@/lib/villageState';

export interface VillageSnapshot {
  id: string;
  name: string;
  food: number;
  foodState: VillageState;
  milesBanked: number;   // from profiles.miles_banked (canonical Mile Bank)
  medicine: number;
  wood: number;
  stone: number;
  morale: number;
  graceExpiresAt: string | null;
}

interface GameState {
  /** Latest village snapshot from TanStack Query — null until first fetch resolves */
  village: VillageSnapshot | null;
  /** True while a GPS session is actively recording (set by Plan B useGpsSession) */
  isSessionActive: boolean;
  /**
   * Live distance (miles) of the active GPS session — WR-01. Pushed by
   * useGpsSession on each accepted GPS point so the persistent RecordingBanner
   * (rendered in (tabs)/_layout) reflects real distance across tabs. Reset to 0
   * when a session starts/stops.
   */
  sessionDistanceMi: number;
  /** Number of pending offline allocations in the SQLite queue (set by Plan D) */
  pendingAllocations: number;

  /** Called by useVillage after each successful fetch/mutation */
  setVillage: (village: VillageSnapshot | null) => void;
  /** Called by useGpsSession (Plan B) to toggle the persistent recording banner */
  setSessionActive: (active: boolean) => void;
  /** Called by useGpsSession (Plan B) on each accepted GPS point — WR-01 */
  setSessionDistanceMi: (distanceMi: number) => void;
  /** Called by sqliteQueue sync (Plan D) */
  setPendingAllocations: (count: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  village: null,
  isSessionActive: false,
  sessionDistanceMi: 0,
  pendingAllocations: 0,

  setVillage: (village) => set({ village }),
  setSessionActive: (active) => set({ isSessionActive: active }),
  setSessionDistanceMi: (distanceMi) => set({ sessionDistanceMi: distanceMi }),
  setPendingAllocations: (count) => set({ pendingAllocations: count }),
}));
