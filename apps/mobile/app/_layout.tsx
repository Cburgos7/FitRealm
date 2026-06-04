import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot, SplashScreen } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Purchases from 'react-native-purchases';
import MapboxGL from '@rnmapbox/maps';
import { useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

// Set Mapbox public access token once at app start (Pattern 2 — no download token needed).
// Token comes from EXPO_PUBLIC_MAPBOX_TOKEN env var; falls back gracefully if not set.
if (process.env.EXPO_PUBLIC_MAPBOX_TOKEN) {
  MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

export default function Root() {
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    const rcKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;
    Purchases.configure({ apiKey: rcKey });

    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    });
    const cleanup = useAuthStore.getState().initialize();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}
