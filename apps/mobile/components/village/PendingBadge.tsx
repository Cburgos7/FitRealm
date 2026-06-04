/**
 * PendingBadge.tsx — shows the count of unsynced offline allocations near
 * the Mile Bank resource chip (D2-38 / ALLOC-04).
 *
 * The badge is small and unobtrusive — a warm amber circle with a number.
 * It is hidden when the count is zero.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '@/store/useGameStore';

export function PendingBadge() {
  const pendingCount = useGameStore((s) => s.pendingAllocations);

  if (pendingCount <= 0) return null;

  return (
    <View
      style={styles.badge}
      accessibilityLabel={`${pendingCount} allocation${pendingCount === 1 ? '' : 's'} pending sync`}
      accessible
    >
      <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#c68b00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
