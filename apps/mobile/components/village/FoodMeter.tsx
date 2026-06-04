/**
 * FoodMeter.tsx — Colorblind-safe animated food level bar (VLG-01/VLG-03/VLG-04/D2-27)
 *
 * COLORBLIND SAFETY RULE (D2-27 / CLAUDE.md):
 *   Always pair color with BOTH an icon AND a text label.
 *   Never use color alone to convey state.
 *
 * States and visual treatment:
 *   thriving  → green bar   + 🌾 icon + "Thriving" label
 *   hungry    → amber bar   + ⚠️ icon  + "Hungry" label  + subtle pulse animation
 *   starving  → red bar     + 💀 icon  + "Starving" label
 *
 * All threshold values (food_cap, food_hungry_threshold) must come from
 * game_config via the `config` prop — no hardcoded balance numbers (INFRA-02).
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { VillageState } from '@/lib/villageState';

interface FoodMeterProps {
  food: number;
  food_state: VillageState;
  foodCap?: number;    // from game_config 'food_cap'; defaults to 100
}

// State-specific visual tokens
const STATE_CONFIG: Record<VillageState, { color: string; icon: string; label: string }> = {
  thriving: {
    color: '#4caf50',   // accessible green
    icon: '🌾',
    label: 'Thriving',
  },
  hungry: {
    color: '#ff9800',   // accessible amber/orange
    icon: '⚠️',
    label: 'Hungry',
  },
  starving: {
    color: '#f44336',   // accessible red
    icon: '💀',
    label: 'Starving',
  },
};

export function FoodMeter({ food, food_state, foodCap = 100 }: FoodMeterProps) {
  const { color, icon, label } = STATE_CONFIG[food_state] ?? STATE_CONFIG.thriving;
  const fillPercent = Math.max(0, Math.min(1, food / foodCap));

  // Pulse animation when hungry (D2-28)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (food_state === 'hungry') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [food_state, pulseAnim]);

  return (
    <View style={styles.container} accessibilityLabel={`Food: ${Math.round(food)} — ${label}`}>
      {/* Colorblind-safe header: icon + text label (never color alone) */}
      <View style={styles.header}>
        <Text style={styles.icon} accessibilityElementsHidden>{icon}</Text>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={styles.value}>{Math.round(food)}</Text>
      </View>

      {/* Animated fill bar */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${fillPercent * 100}%`,
              backgroundColor: color,
              opacity: pulseAnim,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 14,
    marginRight: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  track: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
