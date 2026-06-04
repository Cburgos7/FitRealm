/**
 * GraceBadge.tsx — "Protected — Xh left" countdown badge (D2-25 / VLG-06)
 *
 * Shows a reassuring green badge while a village is inside its 24-hour grace
 * window (grace_expires_at > now). Hides automatically once the window expires.
 *
 * Design notes (D2-25 / D2-41):
 *   • Copy is warm and reassuring — new players should feel encouraged, not
 *     alarmed. "Protected" communicates safety; the countdown is informational.
 *   • The badge uses a shield icon + text label for colorblind safety (D2-27):
 *     never color alone.
 *   • Client NEVER calculates or applies decay — it only reads grace_expires_at
 *     from the server and counts down to that timestamp (VLG-06 / CLAUDE.md).
 *   • On re-render (e.g., foreground refetch) the countdown updates automatically
 *     because `now` is recalculated from the prop value, not a cached time.
 *
 * Props:
 *   graceExpiresAt — ISO date string from villages.grace_expires_at (nullable).
 *                    If null or expired, renders nothing.
 *   compact        — when true, shows only the shield + time (no label text).
 *                    Useful inside tight top-bar rows.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface GraceBadgeProps {
  graceExpiresAt: string | null | undefined;
  compact?: boolean;
}

/**
 * Compute a human-readable time-remaining string from an ISO expiry timestamp.
 * Returns null if the timestamp is in the past or cannot be parsed.
 */
function computeRemaining(graceExpiresAt: string): string | null {
  const expiry = new Date(graceExpiresAt);
  if (isNaN(expiry.getTime())) return null;

  const msLeft = expiry.getTime() - Date.now();
  if (msLeft <= 0) return null;

  const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
  if (hoursLeft > 0) {
    return `${hoursLeft}h left`;
  }
  const minutesLeft = Math.floor(msLeft / (1000 * 60));
  if (minutesLeft > 0) {
    return `${minutesLeft}m left`;
  }
  return 'expiring soon';
}

export function GraceBadge({ graceExpiresAt, compact = false }: GraceBadgeProps) {
  // Tick every minute to keep the countdown current while the screen is open.
  // This does NOT apply decay — it only updates the display string.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!graceExpiresAt) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60_000); // refresh every 60 seconds

    return () => clearInterval(interval);
  }, [graceExpiresAt]);

  if (!graceExpiresAt) return null;

  const remaining = computeRemaining(graceExpiresAt);
  if (!remaining) return null; // grace window expired — hide badge

  if (compact) {
    return (
      <View style={styles.badge} accessibilityLabel={`Village protected — ${remaining}`}>
        <Text style={styles.icon} accessibilityElementsHidden>
          🛡️
        </Text>
        <Text style={styles.timeText}>{remaining}</Text>
      </View>
    );
  }

  return (
    <View style={styles.badge} accessibilityLabel={`Your village is protected — ${remaining}`}>
      {/* Icon + label for colorblind safety — never color alone (D2-27) */}
      <Text style={styles.icon} accessibilityElementsHidden>
        🛡️
      </Text>
      <Text style={styles.label}>Protected</Text>
      <Text style={styles.separator}>·</Text>
      <Text style={styles.timeText}>{remaining}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b5e20',   // deep forest green
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  icon: {
    fontSize: 11,
  },
  label: {
    color: '#a5d6a7',             // soft green text
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    color: '#558b2f',
    fontSize: 11,
  },
  timeText: {
    color: '#c8e6c9',             // lighter green for the countdown
    fontSize: 11,
    fontWeight: '500',
  },
});
