/**
 * Village screen — Phase 2 real Village tab (VLG-01/VLG-02/VLG-03/VLG-04)
 *
 * Composes:
 *   • VillageScene (background illustration per food_state)
 *   • Top overlay bar: FoodMeter + Mile Bank + non-decaying resource counts
 *     (medicine / wood / stone / morale) + PendingBadge on Miles chip
 *   • "Protected" grace badge when grace period is active (D2-25)
 *   • AllocateFab (bottom-right) — opens the AllocateSheet (Plan D / ALLOC-01)
 *   • useSyncQueue — drains SQLite outbox on reconnect (ALLOC-04)
 *
 * Balance values (food_cap, food_hungry_threshold) come from useGameConfig,
 * not hardcoded — INFRA-02 / D2-26.
 *
 * Auto-creates "Thornhaven" with full food on first authenticated launch (D2-35).
 * Decay is server-only; this screen NEVER subtracts food client-side (CLAUDE.md).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SQLite from 'expo-sqlite';
import { VillageScene } from '@/components/village/VillageScene';
import { FoodMeter } from '@/components/village/FoodMeter';
import { AllocateFab } from '@/components/village/AllocateFab';
import { PendingBadge } from '@/components/village/PendingBadge';
import { useVillage } from '@/hooks/useVillage';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { useGameStore } from '@/store/useGameStore';
import { foodToState } from '@/lib/villageState';
import { initQueue, getPendingCount } from '@/lib/sqliteQueue';

export default function VillageScreen() {
  const insets = useSafeAreaInsets();
  const { data: village, isLoading, isError } = useVillage();
  const { data: config } = useGameConfig();
  const setPendingAllocations = useGameStore((s) => s.setPendingAllocations);

  // SQLite DB ref — opened once on mount, shared with AllocateFab and useSyncQueue
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    initQueue().then((opened) => {
      if (!cancelled) {
        setDb(opened);
        // Restore the pending badge count from queue on mount (app restart)
        getPendingCount(opened).then((count) => {
          if (!cancelled) setPendingAllocations(count);
        });
      }
    });
    return () => { cancelled = true; };
  }, [setPendingAllocations]);

  // Wire up sync-on-reconnect (drains SQLite outbox when device goes online)
  useSyncQueue({
    db,
    onRejected: (count) => {
      Alert.alert(
        'Allocation rejected',
        `${count} offline allocation${count > 1 ? 's were' : ' was'} rejected by the server — you may not have had enough miles. Your village state has been updated.`
      );
    },
  });

  // Read balance thresholds from game_config (INFRA-02); fall back to seeded defaults
  const foodCap = Number(config?.['food_cap'] ?? 100);
  const hungryThreshold = Number(config?.['food_hungry_threshold'] ?? 20);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e0cfa9" />
        <Text style={styles.loadingText}>Summoning your village...</Text>
      </View>
    );
  }

  if (isError || !village) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not reach the realm. Try again shortly.</Text>
      </View>
    );
  }

  const food = village.food ?? 100;
  const foodState = foodToState(food, hungryThreshold);

  // Grace period badge: show "Protected" countdown if grace_expires_at is in the future
  const graceExpires = village.grace_expires_at ? new Date(village.grace_expires_at) : null;
  const isProtected = graceExpires ? graceExpires > new Date() : false;

  return (
    <View style={styles.screen}>
      {/* Full-bleed scene background */}
      <VillageScene food_state={foodState} villageName={village.name} />

      {/* Top overlay bar — respects safe area insets */}
      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          {/* Village name + grace badge */}
          <View style={styles.nameRow}>
            <Text style={styles.villageName}>{village.name}</Text>
            {isProtected && (
              <View style={styles.graceBadge}>
                <Text style={styles.graceBadgeText}>
                  Protected {formatGraceRemaining(graceExpires!)}
                </Text>
              </View>
            )}
          </View>

          {/* Food meter — colorblind-safe (color + icon + label) */}
          <FoodMeter food={food} food_state={foodState} foodCap={foodCap} />

          {/* Resource counts row */}
          <View style={styles.resourceRow}>
            {/* Mile Bank (VLG-02) — with PendingBadge overlay for offline queue */}
            <View style={styles.chipWrapper}>
              <ResourceChip icon="⚡" label="Miles" value={formatNum(village.milesBanked)} />
              <PendingBadge />
            </View>
            {/* Non-decaying counts (VLG-01) */}
            <ResourceChip icon="💊" label="Med"    value={formatNum(village.medicine)} />
            <ResourceChip icon="🪵" label="Wood"   value={formatNum(village.wood)} />
            <ResourceChip icon="🪨" label="Stone"  value={formatNum(village.stone)} />
            <ResourceChip icon="🎵" label="Morale" value={formatNum(village.morale)} />
          </View>
        </View>
      </View>

      {/* AllocateFab — opens the allocation bottom sheet (ALLOC-01 / D2-32) */}
      <AllocateFab
        db={db}
        onAllocationSuccess={(foodGain) => {
          // Warm high-fantasy toast (D2-41)
          // Using Alert as a simple cross-platform notification; a toast library
          // (e.g. react-native-toast-message) can be wired here in a later pass.
          Alert.alert(
            'Your hunters return!',
            `A bountiful catch — +${foodGain} Food added to ${village.name}!`
          );
        }}
        onInsufficientMiles={() => {
          Alert.alert(
            'Not enough miles',
            "Your hunters returned empty-handed — you don't have enough miles for this hunt."
          );
        }}
      />
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface ResourceChipProps {
  icon: string;
  label: string;
  value: string;
}

function ResourceChip({ icon, label, value }: ResourceChipProps) {
  return (
    <View style={styles.chip} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatNum(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function formatGraceRemaining(expires: Date): string {
  const msLeft = expires.getTime() - Date.now();
  if (msLeft <= 0) return '';
  const hLeft = Math.floor(msLeft / (1000 * 60 * 60));
  if (hLeft > 0) return `— ${hLeft}h left`;
  const mLeft = Math.floor(msLeft / (1000 * 60));
  return `— ${mLeft}m left`;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 24,
  },
  loadingText: {
    color: '#e0cfa9',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#9e9e9e',
    textAlign: 'center',
    fontSize: 14,
  },

  // Top overlay bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarInner: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  villageName: {
    color: '#e0cfa9',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  graceBadge: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  graceBadgeText: {
    color: '#c8e6c9',
    fontSize: 11,
    fontWeight: '600',
  },

  // Resource row
  resourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipWrapper: {
    flex: 1,
    position: 'relative',
  },
  chip: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipLabel: {
    color: '#9e9e9e',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipValue: {
    color: '#e0cfa9',
    fontSize: 13,
    fontWeight: '600',
  },
});
