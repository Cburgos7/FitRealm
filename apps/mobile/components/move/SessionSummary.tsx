/**
 * SessionSummary.tsx — Post-session summary card (D2-13)
 *
 * Shows: route map thumbnail, distance, auto-detected activity kind,
 * multiplied miles earned, and a Bank button.
 * Rendered as a modal-style overlay in tracker.tsx after stopping.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityKind } from '@/lib/activityDetector';

const ACTIVITY_EMOJI: Record<ActivityKind, string> = {
  walking: '🚶',
  running: '🏃',
  cycling: '🚴',
  hiking: '🥾',
};

const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  walking: 'Walking',
  running: 'Running',
  cycling: 'Cycling',
  hiking: 'Hiking',
};

interface SessionSummaryProps {
  distanceMi: number;
  activityKind: ActivityKind;
  multiplier: number;
  milesEarned: number;
  onBank: () => void;
  onDiscard: () => void;
}

export function SessionSummary({
  distanceMi,
  activityKind,
  multiplier,
  milesEarned,
  onBank,
  onDiscard,
}: SessionSummaryProps) {
  const insets = useSafeAreaInsets();

  const emoji = ACTIVITY_EMOJI[activityKind];
  const label = ACTIVITY_LABEL[activityKind];

  return (
    <View
      style={[
        styles.overlay,
        { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>Session Complete</Text>
        <Text style={styles.subtitle}>Your village awaits your return!</Text>

        {/* Activity pill */}
        <View style={styles.activityPill}>
          <Text style={styles.activityEmoji}>{emoji}</Text>
          <Text style={styles.activityLabel}>{label}</Text>
          <Text style={styles.activityMultiplier}>{multiplier}×</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statKey}>Distance</Text>
            <Text style={styles.statVal}>{distanceMi.toFixed(2)} mi</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statKey}>Multiplier</Text>
            <Text style={styles.statVal}>{multiplier}×</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statKey}>Miles Earned</Text>
            <Text style={[styles.statVal, styles.highlight]}>{milesEarned.toFixed(2)} mi</Text>
          </View>
        </View>

        {/* Narrative toast copy */}
        <Text style={styles.narrative}>
          Your scouts return triumphant — the village grows stronger!
        </Text>

        {/* Bank button */}
        <TouchableOpacity
          style={styles.bankButton}
          onPress={onBank}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Bank ${milesEarned.toFixed(2)} miles`}
        >
          <Text style={styles.bankButtonText}>
            Bank {milesEarned.toFixed(2)} miles
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.discardButton}
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel="Discard session"
        >
          <Text style={styles.discardButtonText}>Discard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f23',
    zIndex: 100,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaaacc',
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3e',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 24,
    gap: 8,
  },
  activityEmoji: {
    fontSize: 24,
  },
  activityLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  activityMultiplier: {
    color: '#7c4dff',
    fontSize: 16,
    fontWeight: '700',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statKey: {
    color: '#aaaacc',
    fontSize: 15,
  },
  statVal: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  highlight: {
    color: '#4caf50',
    fontSize: 17,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a4e',
  },
  narrative: {
    color: '#8888aa',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  bankButton: {
    backgroundColor: '#4caf50',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  discardButton: {
    paddingVertical: 12,
  },
  discardButtonText: {
    color: '#666688',
    fontSize: 15,
  },
});
