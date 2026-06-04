/**
 * VillageScene.tsx — Static per-state village illustration + overlay (VLG-04/D2-30/D2-34)
 *
 * Phase 2 uses placeholder colored backgrounds per state.
 * Real illustrated art is refined later — this plan proves the mechanic.
 *
 * Starving state: dark/desaturated overlay + centered "Your village awaits your return"
 * card guiding the player to hunt food (D2-34). Somber but hopeful, non-punishing.
 *
 * State backgrounds:
 *   thriving  → warm earthy green
 *   hungry    → muted amber
 *   starving  → near-black desaturated
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VillageState } from '@/lib/villageState';

interface VillageSceneProps {
  food_state: VillageState;
  villageName: string;
}

const SCENE_COLORS: Record<VillageState, string> = {
  thriving: '#2d5a27',   // earthy green
  hungry:   '#6b4c1a',   // muted amber-brown
  starving: '#1a1a1a',   // near-black, desaturated
};

// Placeholder art descriptions (replaced with real assets in a later phase)
const SCENE_LABELS: Record<VillageState, string> = {
  thriving: '🏡',
  hungry:   '🏚️',
  starving: '💀',
};

export function VillageScene({ food_state, villageName }: VillageSceneProps) {
  const bgColor = SCENE_COLORS[food_state] ?? SCENE_COLORS.thriving;
  const sceneLabel = SCENE_LABELS[food_state];
  const isStarving = food_state === 'starving';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Placeholder illustration */}
      <Text style={styles.sceneArt} accessibilityLabel={`${villageName} — ${food_state}`}>
        {sceneLabel}
      </Text>

      {/* Starving overlay: dark scrim + card (D2-34) */}
      {isStarving && (
        <View style={styles.starvingOverlay}>
          <View style={styles.starvingCard}>
            <Text style={styles.starvingTitle}>Your village awaits your return</Text>
            <Text style={styles.starvingBody}>
              {villageName} grows cold and silent. Hunt food to restore your village.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneArt: {
    fontSize: 80,
    opacity: 0.8,
  },
  // Starving: full-bleed dark overlay
  starvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  starvingCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    maxWidth: 320,
  },
  starvingTitle: {
    color: '#e0cfa9',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  starvingBody: {
    color: '#9e9e9e',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
