/**
 * move/index.tsx — Move hub (MOV-01, MOV-07, MOV-08, D2-14, D2-15)
 *
 * Features:
 *   - Start GPS Session button → navigates to tracker.tsx
 *   - Manual Entry form (distance + duration → POST /activity/manual)
 *   - Orphan recovery on mount: if a pending_session checkpoint exists,
 *     silently bank partial miles and show a toast (MOV-07/D2-14)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGpsSession } from '@/hooks/useGpsSession';
import { supabase } from '@/lib/supabase';

export default function MoveScreen() {
  const insets = useSafeAreaInsets();
  const { recoverOrphanSession } = useGpsSession();

  // Manual entry form state
  const [distanceInput, setDistanceInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Orphan recovery: run once on mount (MOV-07 / D2-14)
  useEffect(() => {
    let mounted = true;
    recoverOrphanSession().then((recovered) => {
      if (!mounted) return;
      if (recovered) {
        Alert.alert(
          'Session Recovered',
          'Your previous session was interrupted. Your partial miles have been banked automatically!',
          [{ text: 'Great!', style: 'default' }],
        );
      }
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Manual entry ----------

  const handleManualSubmit = async () => {
    const distMi = parseFloat(distanceInput);
    const durMin = parseFloat(durationInput);

    if (!distMi || !durMin || distMi <= 0 || durMin <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid distance (mi) and duration (min).');
      return;
    }

    setManualLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'You must be signed in to log an activity.');
        return;
      }

      const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.fitrealm.com';
      const res = await fetch(`${apiBase}/activity/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ distanceMi: distMi, durationMin: durMin }),
      });

      const body = await res.json();

      if (!res.ok) {
        Alert.alert('Entry Rejected', body.error ?? `Server error: ${res.status}`);
        return;
      }

      Alert.alert(
        'Miles Banked!',
        `${body.milesEarned?.toFixed(2) ?? distMi} miles banked for your village!`,
      );
      setDistanceInput('');
      setDurationInput('');
    } catch (err) {
      Alert.alert('Error', 'Could not submit manual entry. Check your connection and try again.');
    } finally {
      setManualLoading(false);
    }
  };

  // ---------- Render ----------

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 } as const}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Move</Text>
        <Text style={styles.subtitle}>Every step keeps your village alive.</Text>

        {/* Start GPS session */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/move/tracker' as never)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start GPS session"
        >
          <Text style={styles.startButtonText}>🏃 Start GPS Session</Text>
        </TouchableOpacity>

        {/* Manual entry */}
        <View style={styles.manualCard}>
          <Text style={styles.cardTitle}>Log Treadmill / Indoor Workout</Text>
          <Text style={styles.cardSubtitle}>Distance and time — we do the rest.</Text>

          <View style={styles.row}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Distance (mi)"
                placeholderTextColor="#666688"
                keyboardType="decimal-pad"
                value={distanceInput}
                onChangeText={setDistanceInput}
                accessibilityLabel="Distance in miles"
              />
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Duration (min)"
                placeholderTextColor="#666688"
                keyboardType="decimal-pad"
                value={durationInput}
                onChangeText={setDurationInput}
                accessibilityLabel="Duration in minutes"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, manualLoading && styles.submitButtonDisabled]}
            onPress={handleManualSubmit}
            disabled={manualLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Submit manual entry"
          >
            {manualLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Log Activity</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    backgroundColor: '#0f0f23',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#8888aa',
    fontSize: 15,
    marginBottom: 28,
  },
  startButton: {
    backgroundColor: '#4caf50',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  manualCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#8888aa',
    fontSize: 13,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  submitButton: {
    backgroundColor: '#7c4dff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
