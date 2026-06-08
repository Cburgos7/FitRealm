import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';

// Nonce helper for Apple & Google native Sign-In with Supabase.
//
// Both providers' native SDKs auto-inject a nonce into the id_token. Supabase
// validates that nonce: if the token contains one, we MUST pass the raw nonce
// to signInWithIdToken so Supabase can hash it and verify the match.
// (Otherwise: "Passed nonce and nonce in id_token should either both exist or not.")
//
// Per Supabase docs:
//   - Apple:  send HASHED nonce to Apple SDK, RAW nonce to Supabase
//   - Google: send HASHED nonce to Google SDK, RAW nonce to Supabase
async function generateNoncePair(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export default function SignIn() {
  const session = useAuthStore((s) => s.session);

  if (session) {
    return <Redirect href="/(tabs)/village" />;
  }

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.data?.idToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.data.idToken,
        });
        if (error) Alert.alert('Sign in error', error.message);
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code !== 'SIGN_IN_CANCELLED') {
        console.error('Google sign-in error:', err.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitRealm</Text>
      <Text style={styles.subtitle}>Move. Bank. Survive.</Text>

      <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={async () => {
            try {
              const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                  AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                  AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
              });
              if (credential.identityToken) {
                const { error } = await supabase.auth.signInWithIdToken({
                  provider: 'apple',
                  token: credential.identityToken,
                });
                if (error) Alert.alert('Sign in error', error.message);
              }
            } catch (error: unknown) {
              const err = error as { code?: string };
              if (err.code !== 'ERR_REQUEST_CANCELED') {
                console.error('Apple sign-in error:', err);
              }
            }
          }}
        />
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
    backgroundColor: '#0f0f0f',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 56,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
