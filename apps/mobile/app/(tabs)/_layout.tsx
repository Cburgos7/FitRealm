import { View, ActivityIndicator } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function TabsLayout() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);

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
    <Tabs>
      <Tabs.Screen name="village/index" options={{ title: 'Village' }} />
      <Tabs.Screen name="map/index" options={{ title: 'Map' }} />
      <Tabs.Screen name="move/index" options={{ title: 'Move' }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
