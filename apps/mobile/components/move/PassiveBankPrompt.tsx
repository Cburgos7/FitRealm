/**
 * PassiveBankPrompt.tsx — App-open passive miles banking prompt (D2-15, D2-41)
 *
 * Displayed when the gap-fill reconciliation finds passive miles that have not
 * yet been banked. Offers the user a warm high-fantasy prompt to add those
 * miles to the Mile Bank (does NOT auto-feed food — MOV-12 / D2-09).
 *
 * Props:
 *   deltaMiles    - Passive miles available to bank (must be > 0)
 *   onConfirm     - Called when user taps "Add to Bank"
 *   onDismiss     - Called when user taps "Not Now"
 *   loading       - True while the banking RPC is in-flight
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface PassiveBankPromptProps {
  deltaMiles: number;
  onConfirm: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

export function PassiveBankPrompt({
  deltaMiles,
  onConfirm,
  onDismiss,
  loading = false,
}: PassiveBankPromptProps) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Your steps were counted!</Text>
          <Text style={styles.body}>
            You moved{' '}
            <Text style={styles.miles}>{deltaMiles.toFixed(2)} mi</Text>{' '}
            today outside your sessions — add them to your Mile Bank?
          </Text>
          <Text style={styles.hint}>
            Miles feed your village. Every step keeps Thornhaven alive.
          </Text>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Add ${deltaMiles.toFixed(2)} miles to bank`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.confirmText}>Add to Bank</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Dismiss passive miles prompt"
          >
            <Text style={styles.dismissText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#ccccee',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  miles: {
    color: '#4caf50',
    fontWeight: '700',
  },
  hint: {
    color: '#8888aa',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  confirmButton: {
    backgroundColor: '#4caf50',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissText: {
    color: '#8888aa',
    fontSize: 15,
  },
});
