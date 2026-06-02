import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

export default function VillageScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`);
      return res.json();
    },
  });

  const apiStatus = isLoading
    ? 'API: connecting...'
    : isError
    ? 'API: unreachable'
    : `API: ${data?.status} v${data?.version}`;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Village — Coming Soon</Text>
      <Text style={styles.status}>{apiStatus}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  status: { fontSize: 14, color: '#666' },
});
