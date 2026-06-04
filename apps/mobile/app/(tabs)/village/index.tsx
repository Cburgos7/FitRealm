/**
 * Village screen — Phase 2 real Village tab (VLG-01/VLG-02/VLG-03/VLG-04)
 *
 * Composes:
 *   • VillageScene (background illustration per food_state)
 *   • Top overlay bar: FoodMeter + Mile Bank + non-decaying resource counts
 *     (medicine / wood / stone / morale) + PendingBadge on Miles chip
 *   • GraceBadge (D2-25) — "Protected — Xh left" countdown badge
 *   • App-open decay drain framing (D2-28/D2-33):
 *       When a food drop is detected after foreground refetch, a brief
 *       animated drain indicator + narrative toast surfaces — NOT a modal.
 *   • AllocateFab (bottom-right) — opens the AllocateSheet (Plan D / ALLOC-01)
 *   • useSyncQueue — drains SQLite outbox on reconnect (ALLOC-04)
 *
 * Balance values (food_cap, food_hungry_threshold) come from useGameConfig,
 * not hardcoded — INFRA-02 / D2-26.
 *
 * Auto-creates "Thornhaven" with full food on first authenticated launch (D2-35).
 *
 * DECAY INVARIANT (VLG-06 / CLAUDE.md):
 *   Decay is server-only (pg_cron → decay_village_food()).
 *   This screen NEVER subtracts food client-side.
 *   It reads server food on foreground and shows the delta as a narrative toast.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SQLite from 'expo-sqlite';
import { VillageScene } from '@/components/village/VillageScene';
import { FoodMeter } from '@/components/village/FoodMeter';
import { GraceBadge } from '@/components/village/GraceBadge';
import { AllocateFab } from '@/components/village/AllocateFab';
import { PendingBadge } from '@/components/village/PendingBadge';
import { useVillage } from '@/hooks/useVillage';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { useGameStore } from '@/store/useGameStore';
import { foodToState } from '@/lib/villageState';
import { initQueue, getPendingCount } from '@/lib/sqliteQueue';

// ─── Drain framing constants (D2-28/D2-33) ────────────────────────────────────

/**
 * Animated drain banner that briefly flashes a warm narrative message when food
 * has dropped since the last app session. It fades in and auto-dismisses after
 * DRAIN_TOAST_DURATION_MS — never a modal or blocking dialog.
 *
 * The client NEVER applies the delta itself; it only shows what the server reported.
 */
const DRAIN_TOAST_DURATION_MS = 4000;

function getDrainCopy(
  villageName: string,
  foodDelta: number,
  newFoodState: string
): string {
  const abs = Math.abs(foodDelta);
  const roundedDelta = abs < 1 ? abs.toFixed(1) : String(Math.round(abs));

  if (newFoodState === 'starving') {
    return `${villageName} is starving — your village awaits your return.`;
  }
  if (newFoodState === 'hungry') {
    return `${villageName} grows hungry — ${roundedDelta} food consumed.`;
  }
  return `${villageName} consumed ${roundedDelta} food while you were away.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VillageScreen() {
  const insets = useSafeAreaInsets();
  const { data: village, isLoading, isError, foodDropDetected, foodDelta } = useVillage();
  const { data: config } = useGameConfig();
  const setPendingAllocations = useGameStore((s) => s.setPendingAllocations);

  // SQLite DB ref — opened once on mount, shared with AllocateFab and useSyncQueue
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  // ── Drain framing state (D2-28/D2-33) ───────────────────────────────────────
  // When foodDropDetected becomes true (foreground refetch detected a server-side
  // food drop), show a brief animated narrative toast. NOT a modal.
  const drainOpacity = useRef(new Animated.Value(0)).current;
  const [drainMessage, setDrainMessage] = useState<string | null>(null);
  // Track whether we've already shown the drain toast for this session to avoid
  // flashing it repeatedly on multiple re-renders of the same data.
  const drainShownRef = useRef(false);

  useEffect(() => {
    if (
      foodDropDetected &&
      village &&
      !drainShownRef.current
    ) {
      drainShownRef.current = true;
      const foodState = foodToState(
        village.food,
        Number(config?.['food_hungry_threshold'] ?? 20)
      );
      const copy = getDrainCopy(village.name, foodDelta, foodState);
      setDrainMessage(copy);

      // Fade in → hold → fade out (D2-28: on app-open, not an interruption)
      Animated.sequence([
        Animated.timing(drainOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(DRAIN_TOAST_DURATION_MS),
        Animated.timing(drainOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => setDrainMessage(null));
    }
  }, [foodDropDetected, village, foodDelta, config, drainOpacity]);

  // Reset the drain-shown guard when the village ID changes (new game session)
  useEffect(() => {
    drainShownRef.current = false;
  }, [village?.id]);

  // ── SQLite queue init ────────────────────────────────────────────────────────
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
            {/* GraceBadge: "Protected — Xh left" (D2-25, VLG-06) */}
            <GraceBadge graceExpiresAt={village.grace_expires_at} compact />
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

      {/* Drain narrative toast (D2-28/D2-33) — fades in on app-open after a food drop.
          NOT a modal. Positioned above the bottom FAB so it doesn't block allocation.
          The client NEVER modified food to produce this — it reads server truth.       */}
      {drainMessage && (
        <Animated.View
          style={[styles.drainToast, { opacity: drainOpacity }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.drainIcon} accessibilityElementsHidden>
            🍖
          </Text>
          <Text style={styles.drainText}>{drainMessage}</Text>
        </Animated.View>
      )}

      {/* AllocateFab — opens the allocation bottom sheet (ALLOC-01 / D2-32) */}
      <AllocateFab
        db={db}
        onAllocationSuccess={(foodGain) => {
          // Warm high-fantasy toast (D2-41)
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

  // Drain narrative toast (D2-28/D2-33)
  drainToast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(40, 20, 0, 0.90)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Subtle warm border
    borderWidth: 1,
    borderColor: 'rgba(180, 100, 20, 0.4)',
  },
  drainIcon: {
    fontSize: 20,
  },
  drainText: {
    color: '#e0cfa9',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
