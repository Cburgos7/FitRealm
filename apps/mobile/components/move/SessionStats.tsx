/**
 * SessionStats.tsx — Pinned bottom stats sheet during an active GPS session (D2-10)
 *
 * Displays: distance (mi), pace (min/mile), elapsed time, and a large End button.
 * Rendered as an absolute-positioned sheet over the Mapbox map in tracker.tsx.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SessionStatsProps {
  distanceMi: number;
  paceMinPerMile: number;
  elapsedSeconds: number;
  onEnd: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(paceMinPerMile: number): string {
  if (paceMinPerMile <= 0) return '--:--';
  const m = Math.floor(paceMinPerMile);
  const s = Math.round((paceMinPerMile - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SessionStats({
  distanceMi,
  paceMinPerMile,
  elapsedSeconds,
  onEnd,
}: SessionStatsProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{distanceMi.toFixed(2)}</Text>
          <Text style={styles.statLabel}>mi</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatPace(paceMinPerMile)}</Text>
          <Text style={styles.statLabel}>min/mi</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatElapsed(elapsedSeconds)}</Text>
          <Text style={styles.statLabel}>elapsed</Text>
        </View>
      </View>

      {/* End button */}
      <TouchableOpacity
        style={styles.endButton}
        onPress={onEnd}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="End session"
      >
        <Text style={styles.endButtonText}>End Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#aaaacc',
    fontSize: 12,
    marginTop: 2,
  },
  endButton: {
    backgroundColor: '#E53935',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  endButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
