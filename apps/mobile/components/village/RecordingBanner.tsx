/**
 * RecordingBanner.tsx — Persistent recording indicator (D2-11)
 *
 * Shown above all tabs while a GPS session is active.
 * Tapping navigates back to the tracker screen.
 * Positioned using useSafeAreaInsets so it clears the notch/status bar.
 *
 * Mounted in apps/mobile/app/(tabs)/_layout.tsx gated on isSessionActive.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGameStore } from '@/store/useGameStore';

interface RecordingBannerProps {
  style?: ViewStyle;
  /** Current session distance in miles (shown in banner) */
  distanceMi?: number;
}

export function RecordingBanner({ style, distanceMi = 0 }: RecordingBannerProps) {
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    router.push('/move/tracker' as never);
  };

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        { paddingTop: insets.top > 0 ? insets.top : 8 },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Recording active — ${distanceMi.toFixed(2)} miles. Tap to return to tracker.`}
    >
      <Text style={styles.dot}>●</Text>
      <Text style={styles.label}>
        Recording — {distanceMi.toFixed(2)} mi
      </Text>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 999,
  },
  dot: {
    color: '#ffffff',
    fontSize: 10,
    marginRight: 6,
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  arrow: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
