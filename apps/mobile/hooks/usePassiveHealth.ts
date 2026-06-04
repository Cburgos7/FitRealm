/**
 * usePassiveHealth.ts — HealthKit (iOS) / Health Connect (Android) passive
 * distance reading + gap-fill reconciliation + app-open bank prompt (MOV-09)
 *
 * Design decisions:
 *   D2-07  Use platform distance, NOT steps × stride
 *   D2-08  Day key = local-midnight date string (device timezone)
 *   D2-09  Passive miles bank only — NEVER auto-feed food / never touch villages.food
 *   D2-10  Health permission requested on first Move-tab visit (NOT onboarding)
 *   D2-15  App-open prompt: "You moved X mi today — add to bank?"
 *   MOV-12 Banking inserts a 'passive' activities row; does NOT call allocate_food
 *
 * Threat mitigations:
 *   T-02C-DUP  Gap-fill: delta = max(0, healthTotal − creditedSessions)
 *   T-02C-RPT  addCredit(today, delta) after banking prevents re-prompt on reopen
 *   T-02C-AVL  Android initialize() wrapped in try/catch (Pitfall 8)
 *
 * Platform-guarded imports:
 *   react-native-health   — iOS only, guarded by Platform.OS === 'ios'
 *   react-native-health-connect — Android only, guarded by Platform.OS === 'android'
 *   Both imports are lazy (inside effect / function) so the unaffected platform
 *   and Jest test environments never attempt to resolve the native module.
 *
 * Usage (in move/index.tsx):
 *   const { showPrompt, promptDelta, confirmBank, dismissPrompt, bankLoading } =
 *     usePassiveHealth();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { computePassiveDelta } from '@/lib/gapFill';
import { getCreditedToday, addCredit, getTodayKey, ensureTable } from '@/lib/dayCredits';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePassiveHealthResult {
  /** True when the passive bank prompt should be shown */
  showPrompt: boolean;
  /** Delta miles available to bank (> 0 when showPrompt is true) */
  promptDelta: number;
  /** Health permission denied or unavailable — surface a notice in UI */
  healthUnavailable: boolean;
  /** Human-readable reason when healthUnavailable is true */
  unavailableReason: string;
  /** True while the banking RPC is in-flight */
  bankLoading: boolean;
  /** Call to request health permission + read platform distance */
  requestAndRead: () => Promise<void>;
  /** Confirm banking of the passive delta */
  confirmBank: () => Promise<void>;
  /** Dismiss the prompt without banking */
  dismissPrompt: () => void;
}

// ---------------------------------------------------------------------------
// iOS helper — reads today's walking+running distance from HealthKit
// ---------------------------------------------------------------------------

async function readIosDistanceMi(): Promise<number> {
  // Lazy import — only ever executed on iOS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AppleHealthKit = require('react-native-health').default;

  return new Promise<number>((resolve) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const options = {
      startDate: startOfDay.toISOString(),
      unit: 'meter' as const,
      includeManuallyAdded: false, // Pitfall 4 — exclude manual entries
    };

    AppleHealthKit.getDistanceWalkingRunning(
      options,
      (err: unknown, results: { value: number }) => {
        if (err) {
          resolve(0);
          return;
        }
        const meters = results?.value ?? 0;
        resolve(meters / 1609.344);
      },
    );
  });
}

async function initAndRequestIos(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AppleHealthKit = require('react-native-health').default;

  return new Promise<boolean>((resolve) => {
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.Workout,
        ],
        write: [] as string[],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (error: unknown) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

// ---------------------------------------------------------------------------
// Android helper — reads today's distance from Health Connect
// ---------------------------------------------------------------------------

async function initAndRequestAndroid(): Promise<{ ok: boolean; reason: string }> {
  try {
    // Lazy import — only ever executed on Android
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HC = require('react-native-health-connect');

    // Pitfall 8 — initialize() throws SdkNotAvailableError on Android 13 without
    // the Health Connect app installed, and on Android <12. Catch it gracefully.
    await HC.initialize();

    await HC.requestPermission([
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    return { ok: true, reason: '' };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Health Connect is not available on this device.';

    // SdkNotAvailableError — Health Connect not installed / Android version too old
    const isUnavailable =
      message.includes('SdkNotAvailable') ||
      message.includes('not available') ||
      message.includes('not installed');

    if (isUnavailable) {
      return {
        ok: false,
        reason: 'Passive sync requires Health Connect. Download it from the Play Store.',
      };
    }

    return {
      ok: false,
      reason: 'Could not connect to Health Connect. Passive sync is unavailable.',
    };
  }
}

async function readAndroidDistanceMi(): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HC = require('react-native-health-connect');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const distanceRecords = await HC.readRecords('Distance', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: new Date().toISOString(),
      },
    });

    // Sum all Distance records for today — each has distance.inMeters (D2-07)
    const totalMeters = (distanceRecords?.records ?? []).reduce(
      (sum: number, r: { distance: { inMeters: number } }) => sum + (r.distance?.inMeters ?? 0),
      0,
    );

    return totalMeters / 1609.344;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePassiveHealth(): UsePassiveHealthResult {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptDelta, setPromptDelta] = useState(0);
  const [healthUnavailable, setHealthUnavailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [bankLoading, setBankLoading] = useState(false);

  // Prevent re-entrant calls while a read is already in-flight
  const readingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // requestAndRead — request permission + read distance + compute delta
  // ---------------------------------------------------------------------------

  const requestAndRead = useCallback(async () => {
    if (readingRef.current) return;
    readingRef.current = true;

    try {
      await ensureTable();
      const today = getTodayKey();
      let totalHealthMi = 0;

      if (Platform.OS === 'ios') {
        const granted = await initAndRequestIos();
        if (!granted) {
          setHealthUnavailable(true);
          setUnavailableReason('Health permission was denied. Grant it in iOS Settings → Privacy → Health → FitRealm.');
          return;
        }
        totalHealthMi = await readIosDistanceMi();

      } else if (Platform.OS === 'android') {
        const { ok, reason } = await initAndRequestAndroid();
        if (!ok) {
          setHealthUnavailable(true);
          setUnavailableReason(reason);
          return;
        }
        totalHealthMi = await readAndroidDistanceMi();

      } else {
        // Other platforms (web, etc.) — skip silently
        return;
      }

      // Gap-fill reconciliation — creditedSessionsMi comes from Plan B's day_credits table
      const creditedSessionsMi = await getCreditedToday(today);
      const delta = computePassiveDelta({ totalHealthDistanceMi: totalHealthMi, creditedSessionsMi });

      if (delta > 0.01) {
        // Only surface prompt if delta is meaningful (>0.01 mi ≈ ~16m)
        setPromptDelta(delta);
        setShowPrompt(true);
      }
    } finally {
      readingRef.current = false;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // confirmBank — insert activities row + increment miles_banked + addCredit
  // ---------------------------------------------------------------------------

  const confirmBank = useCallback(async () => {
    if (bankLoading || promptDelta <= 0) return;
    setBankLoading(true);

    try {
      const today = getTodayKey();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Not authenticated — dismiss silently; miles persist until next open
        setShowPrompt(false);
        return;
      }

      const userId = session.user.id;

      // 1. Insert a 'passive' activities row (T-02C-ID — RLS scoped to auth.uid())
      const { error: insertError } = await supabase.from('activities').insert({
        user_id: userId,
        type: 'passive',
        activity_kind: 'walking',   // passive distance defaults to walking (display-only)
        raw_distance_mi: promptDelta,
        multiplier: 1.0,
        miles_earned: promptDelta,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });

      if (insertError) {
        // Non-fatal — still attempt to bank miles
        console.warn('[usePassiveHealth] activities insert error:', insertError.message);
      }

      // 2. Increment profiles.miles_banked — NEVER touches villages.food (MOV-12 / D2-09)
      const { error: rpcError } = await supabase.rpc('increment_miles_banked', {
        p_user_id: userId,
        p_miles: promptDelta,
      });

      if (rpcError) {
        console.warn('[usePassiveHealth] increment_miles_banked error:', rpcError.message);
        // Fall through to addCredit anyway so we don't re-prompt the same miles
      }

      // 3. Record credited miles so the next app open doesn't re-offer these miles
      //    (T-02C-RPT mitigation — Pitfall 4)
      await addCredit(today, promptDelta);

    } catch (err) {
      console.warn('[usePassiveHealth] confirmBank error:', err);
    } finally {
      setBankLoading(false);
      setShowPrompt(false);
      setPromptDelta(0);
    }
  }, [bankLoading, promptDelta]);

  // ---------------------------------------------------------------------------
  // dismissPrompt — user tapped "Not Now"
  // ---------------------------------------------------------------------------

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    // Note: we do NOT call addCredit here. The miles remain uncredited so the
    // user will be prompted again on the next app open if they still haven't
    // banked them. This is intentional — the prompt respects the player's choice
    // to defer without silently discarding the miles.
  }, []);

  return {
    showPrompt,
    promptDelta,
    healthUnavailable,
    unavailableReason,
    bankLoading,
    requestAndRead,
    confirmBank,
    dismissPrompt,
  };
}
