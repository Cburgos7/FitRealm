/**
 * app/index.tsx — Root route gate
 *
 * Resolves the bare `/` URL so the app doesn't land on expo-router's
 * "Unmatched Route" screen when the dev client loads without a path.
 *
 * Logic:
 *   - isLoading        → spinner (auth store hasn't resolved yet)
 *   - !session         → redirect to /sign-in
 *   - session          → redirect to /(tabs)/village
 *
 * (tabs)/_layout.tsx has the same guard for in-tab navigation; this
 * file just covers the cold-launch path.
 */
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f23' }}>
        <ActivityIndicator size="large" color="#e0cfa9" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href="/(tabs)/village" />;
}
