/**
 * AllocateFab.tsx — Floating action button (bottom-right) that opens the
 * AllocateSheet (ALLOC-01 / D2-32).
 *
 * The FAB is a simple pressable circle with a sword icon.  It is intentionally
 * kept minimal so the village scene background remains visible.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AllocateSheet } from '@/components/allocate/AllocateSheet';
import type { SQLiteDatabase } from 'expo-sqlite';

interface AllocateFabProps {
  db: SQLiteDatabase | null;
  onAllocationSuccess?: (foodGain: number) => void;
  onInsufficientMiles?: () => void;
}

export function AllocateFab({ db, onAllocationSuccess, onInsufficientMiles }: AllocateFabProps) {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = React.useState(false);

  return (
    <>
      {/* FAB */}
      <View
        style={[styles.fabContainer, { paddingBottom: insets.bottom }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setSheetVisible(true)}
          accessibilityLabel="Allocate miles"
          accessibilityHint="Opens the allocation screen to spend miles on your village"
        >
          <Text style={styles.fabIcon}>⚔️</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom sheet */}
      <AllocateSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        db={db}
        onSuccess={onAllocationSuccess}
        onInsufficientMiles={onInsufficientMiles}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7b5e2a',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 24,
  },
});
