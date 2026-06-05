/**
 * (tabs)/_layout.tsx — Authenticated tab layout with persistent RecordingBanner (Pattern 7)
 *
 * RecordingBanner is rendered absolutely above <Tabs> when isSessionActive is true
 * so it persists across all tabs without blocking navigation (D2-11).
 *
 * Uses useSafeAreaInsets for the banner offset (Pattern 7 caveat A2).
 */

import { View, ActivityIndicator } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { RecordingBanner } from '@/components/village/RecordingBanner';

export default function TabsLayout() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isSessionActive = useGameStore((s) => s.isSessionActive);
  // WR-01: live session distance pushed by useGpsSession on each accepted GPS point.
  const sessionDistanceMi = useGameStore((s) => s.sessionDistanceMi);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs>
        <Tabs.Screen name="village/index" options={{ title: 'Village' }} />
        <Tabs.Screen name="map/index" options={{ title: 'Map' }} />
        <Tabs.Screen name="move/index" options={{ title: 'Move' }} />
        <Tabs.Screen name="move/tracker" options={{ href: null }} />
        <Tabs.Screen name="profile/index" options={{ title: 'Profile' }} />
      </Tabs>
      {isSessionActive && (
        <RecordingBanner
          distanceMi={sessionDistanceMi}
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />
      )}
    </View>
  );
}
