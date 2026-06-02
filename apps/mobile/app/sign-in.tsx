import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignIn() {
  const session = useAuthStore((s) => s.session);

  if (session) {
    return <Redirect href="/(tabs)/village" />;
  }

  const signInWithGoogle = () => {
    console.log('Google sign-in not yet configured');
  };

  const signInWithApple = () => {
    console.log('Apple sign-in not yet configured');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitRealm</Text>
      <TouchableOpacity style={styles.button} onPress={signInWithGoogle}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && (
        <TouchableOpacity style={[styles.button, styles.appleButton]} onPress={signInWithApple}>
          <Text style={styles.buttonText}>Sign in with Apple</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
