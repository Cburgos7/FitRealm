/**
 * AllocateSheet.tsx — bottom sheet (≈70% screen height) over the village
 * for spending miles on resources (ALLOC-01 / D2-20).
 *
 * Phase 2 wired actions:
 *   • Hunt Food — fully wired with a tap-once + quantity stepper (D2-23)
 *
 * Phase 2 visible-but-disabled ("coming soon") — D2-22:
 *   • Gather Medicine, Chop Wood, Quarry Stone, Defend Village
 *   (Their downstream resources don't decay in Phase 2; wired in later phases.)
 *
 * Balance values (hunt_food_miles_cost, food_per_mile) come from game_config,
 * never hardcoded — INFRA-02 / D2-26.
 *
 * Accessibility: greyed-out options have accessibilityState.disabled=true.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGameConfig } from '@/hooks/useGameConfig';
import { useGameStore } from '@/store/useGameStore';
import { useAllocate, generateIdempotencyKey } from '@/hooks/useAllocate';
import type { SQLiteDatabase } from 'expo-sqlite';

interface AllocateSheetProps {
  visible: boolean;
  onClose: () => void;
  /** SQLite DB for offline queue */
  db: SQLiteDatabase | null;
  /** Optional callback after a successful allocation (e.g. show a toast) */
  onSuccess?: (foodGain: number) => void;
  /** Optional callback when the server rejects for insufficient_miles */
  onInsufficientMiles?: () => void;
}

export function AllocateSheet({
  visible,
  onClose,
  db,
  onSuccess,
  onInsufficientMiles,
}: AllocateSheetProps) {
  const insets = useSafeAreaInsets();
  const { data: config } = useGameConfig();
  const milesBanked = useGameStore((s) => s.village?.milesBanked ?? 0);
  const { allocate } = useAllocate();

  // Quantity stepper state (D2-23)
  const [quantity, setQuantity] = useState(1);
  const [isConfirming, setIsConfirming] = useState(false);

  // CR-05: stable idempotency key per allocation intent. One key is reused for
  // every retry of the SAME intent (same action + quantity) — including a
  // re-press after a transport error and the offline-queue replay — so the
  // server's idempotency_key UNIQUE dedupes the re-attempt instead of letting it
  // become a second real spend. A fresh key is minted when the intent signature
  // changes (quantity edited) or after a successful allocation.
  const intentRef = useRef<{ signature: string; key: string } | null>(null);
  const getIntentKey = useCallback((signature: string): string => {
    if (!intentRef.current || intentRef.current.signature !== signature) {
      intentRef.current = { signature, key: generateIdempotencyKey() };
    }
    return intentRef.current.key;
  }, []);

  // Read rates from game_config (INFRA-02); fall back to seeded defaults
  const huntMilesCost = Number(config?.['hunt_food_miles_cost'] ?? 1);
  const foodPerMile = Number(config?.['food_per_mile'] ?? 10);
  const hungryThreshold = Number(config?.['food_hungry_threshold'] ?? 20);

  const totalMilesCost = quantity * huntMilesCost;
  const totalFoodGain = quantity * foodPerMile;
  const canAfford = milesBanked >= totalMilesCost;

  // Reset quantity when sheet opens
  useEffect(() => {
    if (visible) setQuantity(1);
  }, [visible]);

  // ── Swipe-down dismiss gesture ────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 10,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy }) => {
        if (dy > 80) {
          // Dismiss
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleConfirm = useCallback(async () => {
    if (!canAfford || isConfirming) return;
    setIsConfirming(true);

    // CR-05: reuse the SAME key for this intent across retries + offline replay.
    const idempotencyKey = getIntentKey(`hunt_food:${quantity}`);

    const result = await allocate({
      milesCost: totalMilesCost,
      foodGain: totalFoodGain,
      action: 'hunt_food',
      db,
      hungryThreshold,
      idempotencyKey,
    });

    setIsConfirming(false);

    if (result.insufficientMiles) {
      // Intent refused — mint a fresh key next time so a later, genuinely new
      // attempt is not deduped against this rejected one.
      intentRef.current = null;
      onInsufficientMiles?.();
    } else if (result.success) {
      // Intent fulfilled (synced or queued) — retire this key so the next
      // allocation is a distinct intent.
      intentRef.current = null;
      onSuccess?.(totalFoodGain);
      onClose();
    }
    // If result.mode === 'error' (transport error) we leave the sheet open AND
    // keep intentRef so a re-press reuses the same idempotency key (the server
    // may have already committed the first attempt).
  }, [
    canAfford,
    isConfirming,
    allocate,
    getIntentKey,
    quantity,
    totalMilesCost,
    totalFoodGain,
    db,
    hungryThreshold,
    onSuccess,
    onInsufficientMiles,
    onClose,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {/* Tap-outside backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close allocate sheet"
      />

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        <Text style={styles.title}>Spend Miles</Text>
        <Text style={styles.balance}>
          Mile Bank: <Text style={styles.balanceValue}>{formatMiles(milesBanked)} mi</Text>
        </Text>

        {/* ── Hunt Food (fully wired) ────────────────────────────────────── */}
        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionIcon}>🍖</Text>
            <View style={styles.optionTitleBlock}>
              <Text style={styles.optionName}>Hunt Food</Text>
              <Text style={styles.optionRate}>
                {huntMilesCost} mi → +{foodPerMile} food per hunt
              </Text>
            </View>
          </View>

          {/* Quantity stepper (D2-23) */}
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              accessibilityLabel="Decrease quantity"
              disabled={quantity <= 1}
            >
              <Text style={[styles.stepBtnText, quantity <= 1 && styles.stepBtnDisabled]}>−</Text>
            </TouchableOpacity>

            <Text style={styles.qty}>{quantity}</Text>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setQuantity((q) => q + 1)}
              accessibilityLabel="Increase quantity"
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.optionSummary}>
            Cost: {totalMilesCost} mi → +{totalFoodGain} food
          </Text>

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!canAfford || isConfirming) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!canAfford || isConfirming}
            accessibilityLabel={`Confirm Hunt Food ×${quantity}`}
            accessibilityState={{ disabled: !canAfford || isConfirming }}
          >
            <Text style={styles.confirmBtnText}>
              {isConfirming
                ? 'Sending hunters...'
                : canAfford
                ? `Hunt Food ×${quantity}`
                : 'Not enough miles'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Coming-soon options (D2-22) — visible but disabled ──────────── */}
        <ComingSoonOption icon="💊" name="Gather Medicine" />
        <ComingSoonOption icon="🪵" name="Chop Wood" />
        <ComingSoonOption icon="🪨" name="Quarry Stone" />
        <ComingSoonOption icon="⚔️" name="Defend Village" />
      </Animated.View>
    </Modal>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function ComingSoonOption({ icon, name }: { icon: string; name: string }) {
  return (
    <View
      style={[styles.optionCard, styles.optionCardDisabled]}
      accessibilityLabel={`${name} — coming soon`}
      accessible
    >
      <View style={styles.optionHeader}>
        <Text style={[styles.optionIcon, styles.textDisabled]}>{icon}</Text>
        <View style={styles.optionTitleBlock}>
          <Text style={[styles.optionName, styles.textDisabled]}>{name}</Text>
          <Text style={[styles.optionRate, styles.textDisabled]}>Coming soon</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMiles(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(1);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#1e1a14',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5a4a2a',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#e0cfa9',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  balance: {
    color: '#9e9e9e',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  balanceValue: {
    color: '#e0cfa9',
    fontWeight: '600',
  },

  // Option cards
  optionCard: {
    backgroundColor: '#2a2215',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3a2e18',
  },
  optionCardDisabled: {
    opacity: 0.45,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionTitleBlock: {
    flex: 1,
  },
  optionName: {
    color: '#e0cfa9',
    fontSize: 16,
    fontWeight: '700',
  },
  optionRate: {
    color: '#9e9e9e',
    fontSize: 12,
    marginTop: 2,
  },
  textDisabled: {
    color: '#6b6050',
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a2e18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: '#e0cfa9',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  stepBtnDisabled: {
    color: '#5a4a2a',
  },
  qty: {
    color: '#e0cfa9',
    fontSize: 24,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  optionSummary: {
    color: '#b8a878',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Confirm button
  confirmBtn: {
    backgroundColor: '#7b5e2a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#3a2e18',
  },
  confirmBtnText: {
    color: '#e0cfa9',
    fontSize: 15,
    fontWeight: '700',
  },
});
