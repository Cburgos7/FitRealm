/**
 * useGpsSession.ts — GPS session lifecycle hook (MOV-01, MOV-02, MOV-05–07, MOV-10, MOV-11)
 *
 * Flow:
 *   startSession → request foreground permission (first time only, MOV-10)
 *               → Android 12 coarse/precise check (MOV-11)
 *               → watchPositionAsync (BestForNavigation, 1s/5m)
 *               → discard accuracy >20m (MOV-02)
 *               → Kalman filter lat/lon
 *               → haversine distance accumulation
 *               → write SecureStore checkpoint on first accepted point (MOV-07)
 *               → set isSessionActive = true
 *
 *   stopSession  → detect activity via activityDetector
 *               → insert activities row + increment profiles.miles_banked (RPC)
 *               → dayCredits.addCredit(todayKey, milesEarned) (D2-06/Pitfall 4)
 *               → upload GeoJSON to Storage via routeUpload
 *               → clear SecureStore checkpoint
 *               → set isSessionActive = false
 *
 *   On mount     → orphan recovery: if 'pending_session' key exists, bank
 *               → partial miles + addCredit + toast + clear (MOV-07/D2-14)
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

import { KalmanFilter } from '@/lib/kalman';
import { haversineDistance, isNoiseSegment } from '@/lib/haversine';
import { detectActivityType, ActivityResult } from '@/lib/activityDetector';
import * as dayCredits from '@/lib/dayCredits';
import { getTodayKey } from '@/lib/dayCredits';
import { uploadRoute } from '@/lib/routeUpload';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/lib/supabase';
import { useGameConfig } from '@/hooks/useGameConfig';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHECKPOINT_KEY = 'pending_session';
const ACCURACY_THRESHOLD_M = 20;

// IN-02: minimum per-segment movement (metres). Accepted fixes whose haversine
// delta from the last accepted point is below this are treated as GPS noise
// (drift while standing still) and discarded — they neither accumulate distance
// nor advance the route/baseline. This stops a stationary user with jittery
// sub-20m fixes from inflating distance (and therefore miles). The baseline is
// NOT advanced on a sub-threshold fix, so genuine slow movement still
// accumulates once the cumulative drift crosses the threshold.
const MIN_SEGMENT_DISTANCE_M = 4;

// WR-08: safe-default detector config mirroring the seeded game_config values.
// Used when useGameConfig has not yet resolved at End-Session time, so a
// completed session is banked normally (pace-derived walking/running) instead of
// being silently dropped and mis-recovered later as a flat walking activity.
const DEFAULT_DETECTOR_CONFIG: import('@/lib/activityDetector').ActivityDetectorConfig = {
  pace_cycle_threshold_mph: 12,
  pace_run_threshold_mpm: 12,
  elevation_hike_gain_m: 50,
  multiplier_walking: 1.0,
  multiplier_running: 1.25,
  multiplier_cycling: 1.25,
  multiplier_hiking: 1.5,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionCheckpoint {
  startedAt: string;
  rawDistanceMi: number;
  routeCoords: [number, number][];
}

export interface GpsSessionState {
  isActive: boolean;
  distanceMi: number;
  elapsedSeconds: number;
  routeCoords: [number, number][];
  /** Latest GPS accuracy in metres (for colour indicator) */
  accuracyM: number | null;
  paceMinPerMile: number;
}

interface UseGpsSessionReturn extends GpsSessionState {
  startSession: () => Promise<void>;
  stopSession: () => Promise<{ result: ActivityResult; distanceMi: number } | null>;
  /** Exposed for orphan recovery — called once on app mount */
  recoverOrphanSession: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGpsSession(): UseGpsSessionReturn {
  const { data: config } = useGameConfig();
  const setSessionActive = useGameStore((s) => s.setSessionActive);
  const setSessionDistanceMi = useGameStore((s) => s.setSessionDistanceMi);
  const village = useGameStore((s) => s.village);

  const [state, setState] = useState<GpsSessionState>({
    isActive: false,
    distanceMi: 0,
    elapsedSeconds: 0,
    routeCoords: [],
    accuracyM: null,
    paceMinPerMile: 0,
  });

  // Internal refs (survive re-renders without triggering them)
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const latFilterRef = useRef(new KalmanFilter());
  const lonFilterRef = useRef(new KalmanFilter());
  const routeCoordsRef = useRef<[number, number][]>([]);
  const distanceMiRef = useRef(0);
  const startedAtRef = useRef<Date | null>(null);
  const lastAcceptedRef = useRef<[number, number] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- helpers ----------

  const getConfigNum = useCallback((key: string, fallback: number) => {
    const v = config?.[key];
    return v !== undefined ? Number(v) : fallback;
  }, [config]);

  const calcPace = (distanceMi: number, elapsedSec: number): number => {
    if (distanceMi <= 0 || elapsedSec <= 0) return 0;
    return elapsedSec / 60 / distanceMi; // min/mile
  };

  const writeCheckpoint = useCallback(async (distMi: number) => {
    const checkpoint: SessionCheckpoint = {
      startedAt: startedAtRef.current?.toISOString() ?? new Date().toISOString(),
      rawDistanceMi: distMi,
      routeCoords: routeCoordsRef.current.slice(-50), // keep last 50 points
    };
    await SecureStore.setItemAsync(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  }, []);

  // ---------- permission flow (MOV-10, MOV-11) ----------

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== 'granted') {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') {
        Alert.alert(
          'Location Required',
          'FitRealm needs location access to track your movement and earn miles for your village.',
        );
        return false;
      }
      // Android 12+: check for coarse-only grant (MOV-11)
      if (result.android?.accuracy === 'coarse') {
        Alert.alert(
          'Precise Location Needed',
          'You granted approximate location. FitRealm needs precise location for accurate distance tracking. Please update the setting.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
    }
    return true;
  }, []);

  // ---------- start ----------

  const startSession = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    // Reset state
    latFilterRef.current = new KalmanFilter({
      Q: getConfigNum('kalman_process_noise', 0.00001),
      R: getConfigNum('kalman_measurement_noise', 0.0001),
    });
    lonFilterRef.current = new KalmanFilter({
      Q: getConfigNum('kalman_process_noise', 0.00001),
      R: getConfigNum('kalman_measurement_noise', 0.0001),
    });
    routeCoordsRef.current = [];
    distanceMiRef.current = 0;
    lastAcceptedRef.current = null;
    startedAtRef.current = new Date();
    let firstPointAccepted = false;

    setState((s) => ({
      ...s,
      isActive: true,
      distanceMi: 0,
      elapsedSeconds: 0,
      routeCoords: [],
      accuracyM: null,
      paceMinPerMile: 0,
    }));
    setSessionActive(true);
    setSessionDistanceMi(0); // WR-01: reset banner distance at session start

    // Elapsed time ticker
    timerRef.current = setInterval(() => {
      const elapsed = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000)
        : 0;
      setState((s) => ({
        ...s,
        elapsedSeconds: elapsed,
        paceMinPerMile: calcPace(s.distanceMi, elapsed),
      }));
    }, 1000);

    // GPS watcher
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      async (update) => {
        const { latitude, longitude, accuracy } = update.coords;

        // Discard poor-accuracy fixes (MOV-02 / D2-12)
        if (!accuracy || accuracy > ACCURACY_THRESHOLD_M) {
          setState((s) => ({ ...s, accuracyM: accuracy ?? null }));
          return;
        }

        // WR-03: seed the filters with the FIRST raw measurement BEFORE
        // filtering it, so the first stored point is the real coordinate — not
        // a value biased from the filter's x=0 default toward (0,0). Previously
        // the first filter() ran on x=0 and produced a corrupted near-(0,0)
        // blend, and the next point's haversine delta against that bad seed
        // injected a large spurious distance on segment 2 (inflating miles).
        if (!lastAcceptedRef.current) {
          latFilterRef.current.reset(latitude);
          lonFilterRef.current.reset(longitude);
        }

        // Kalman smooth
        const smoothLat = latFilterRef.current.filter(latitude);
        const smoothLon = lonFilterRef.current.filter(longitude);
        const point: [number, number] = [smoothLon, smoothLat];

        // Accumulate distance only when a previous accepted point exists
        // (no spurious segment from the seed point).
        if (lastAcceptedRef.current) {
          const deltaM = haversineDistance(lastAcceptedRef.current, point);
          // IN-02: drop sub-threshold segments as GPS noise. Do NOT advance the
          // baseline or append to the route on a noise fix — that way cumulative
          // slow movement still crosses the threshold and counts, while
          // stationary jitter is rejected.
          if (isNoiseSegment(deltaM, MIN_SEGMENT_DISTANCE_M)) {
            setState((s) => ({ ...s, accuracyM: accuracy }));
            return;
          }
          const deltaMi = deltaM / 1609.344;
          distanceMiRef.current += deltaMi;
        }
        lastAcceptedRef.current = point;
        routeCoordsRef.current = [...routeCoordsRef.current, point];

        // Write/update SecureStore checkpoint on first accepted point (Pitfall 6)
        if (!firstPointAccepted) {
          firstPointAccepted = true;
        }
        await writeCheckpoint(distanceMiRef.current);

        // WR-01: push live distance into the store so the persistent
        // RecordingBanner (rendered in (tabs)/_layout) shows real distance.
        setSessionDistanceMi(distanceMiRef.current);

        setState((s) => ({
          ...s,
          distanceMi: distanceMiRef.current,
          routeCoords: routeCoordsRef.current,
          accuracyM: accuracy,
        }));
      },
    );
  }, [getConfigNum, requestPermission, setSessionActive, setSessionDistanceMi, writeCheckpoint]);

  // ---------- stop + bank ----------

  const stopSession = useCallback(async (): Promise<{ result: ActivityResult; distanceMi: number } | null> => {
    // Stop watcher and timer
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const rawDistanceMi = distanceMiRef.current;
    const routeCoords = routeCoordsRef.current;

    if (rawDistanceMi <= 0) {
      // Full reset — partial spread left elapsedSeconds/distanceMi/routeCoords
      // intact, so re-entering the tracker showed the old timer.
      setState({
        isActive: false,
        distanceMi: 0,
        elapsedSeconds: 0,
        routeCoords: [],
        accuracyM: null,
        paceMinPerMile: 0,
      });
      // Clear refs so a fresh session starts from a clean slate
      distanceMiRef.current = 0;
      routeCoordsRef.current = [];
      lastAcceptedRef.current = null;
      startedAtRef.current = null;
      setSessionActive(false);
      setSessionDistanceMi(0); // WR-01: clear banner distance
      await SecureStore.deleteItemAsync(CHECKPOINT_KEY);
      return null;
    }

    // WR-08: if game_config has not yet resolved, do NOT drop the completed
    // session. Fall back to seeded-default multipliers/thresholds so the real
    // distance is banked normally (pace-derived kind) instead of being stranded
    // and later mis-recovered as a flat walking activity by orphan recovery.
    const detectorConfig = (config ??
      DEFAULT_DETECTOR_CONFIG) as import('@/lib/activityDetector').ActivityDetectorConfig;

    const elapsedSec = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000)
      : 0;
    const paceMinPerMile = calcPace(rawDistanceMi, elapsedSec);
    const avgSpeedMph = paceMinPerMile > 0 ? 60 / paceMinPerMile : 0;

    // TODO: elevation gain calculation requires altitude data from GPS fixes
    // For now, pass 0 (no elevation data) — hiking detection requires device E2E
    const elevGainMPerKm = 0;

    const activityResult = detectActivityType(avgSpeedMph, paceMinPerMile, elevGainMPerKm, detectorConfig);
    const milesEarned = rawDistanceMi * activityResult.multiplier;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const endedAt = new Date().toISOString();
      const startedAt = startedAtRef.current?.toISOString() ?? endedAt;

      // 1. Insert activity row + increment miles_banked
      const { data: activity, error: actErr } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          type: 'gps',
          activity_kind: activityResult.kind,
          raw_distance_mi: rawDistanceMi,
          multiplier: activityResult.multiplier,
          miles_earned: milesEarned,
          started_at: startedAt,
          ended_at: endedAt,
        })
        .select('id')
        .single();

      if (actErr) throw actErr;

      // 2. Increment profiles.miles_banked — CR-01: surface the RPC error so a
      //    failed credit does NOT mark the miles as credited below. Throwing
      //    lands us in the catch block, which leaves the SecureStore checkpoint
      //    intact for orphan recovery to re-bank on next launch.
      const { error: bankErr } = await supabase.rpc('increment_miles_banked', {
        p_user_id: user.id,
        p_miles: milesEarned,
      });
      if (bankErr) {
        throw new Error(`increment_miles_banked failed: ${bankErr.message}`);
      }

      // 3. Record in day_credits so passive gap-fill doesn't double-count (D2-06/Pitfall 4)
      //    Only reached when the bank credit above succeeded.
      await dayCredits.ensureTable();
      await dayCredits.addCredit(getTodayKey(), milesEarned);

      // 4. Upload GeoJSON route to Storage (MOV-03)
      if (routeCoords.length > 1 && activity?.id) {
        await uploadRoute(user.id, activity.id, routeCoords).catch((err) => {
          console.warn('Route upload failed (non-fatal):', err);
        });
      }

      // 5. Clear checkpoint — session successfully banked
      await SecureStore.deleteItemAsync(CHECKPOINT_KEY);

      setState({
        isActive: false,
        distanceMi: 0,
        elapsedSeconds: 0,
        routeCoords: [],
        accuracyM: null,
        paceMinPerMile: 0,
      });
      setSessionActive(false);
      setSessionDistanceMi(0); // WR-01: clear banner distance

      return { result: activityResult, distanceMi: rawDistanceMi };
    } catch (err) {
      console.error('Session bank failed:', err);
      // Still stop UI session — checkpoint remains for orphan recovery
      setState((s) => ({ ...s, isActive: false }));
      setSessionActive(false);
      setSessionDistanceMi(0); // WR-01: clear banner distance
      return null;
    }
  }, [config, setSessionActive, setSessionDistanceMi]);

  // ---------- orphan recovery (MOV-07 / D2-14) ----------

  const recoverOrphanSession = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await SecureStore.getItemAsync(CHECKPOINT_KEY);
      if (!raw) return false;

      const checkpoint: SessionCheckpoint = JSON.parse(raw);
      const partialMi = checkpoint.rawDistanceMi ?? 0;

      if (partialMi <= 0) {
        await SecureStore.deleteItemAsync(CHECKPOINT_KEY);
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Bank the partial miles as a GPS activity
      const { data: activity } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          type: 'gps',
          activity_kind: 'walking', // conservative fallback for orphan
          raw_distance_mi: partialMi,
          multiplier: 1.0,
          miles_earned: partialMi,
          started_at: checkpoint.startedAt,
          ended_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      // CR-01: if the bank credit fails, do NOT addCredit and do NOT clear the
      // checkpoint — leave it so the next launch retries orphan recovery rather
      // than silently discarding the miles.
      const { error: bankErr } = await supabase.rpc('increment_miles_banked', {
        p_user_id: user.id,
        p_miles: partialMi,
      });
      if (bankErr) {
        console.warn('Orphan recovery bank failed; keeping checkpoint for retry:', bankErr.message);
        return false;
      }

      // Record in day_credits (D2-06) — only after a successful bank.
      await dayCredits.ensureTable();
      await dayCredits.addCredit(getTodayKey(), partialMi);

      // Upload partial route if we have coords
      if (activity?.id && checkpoint.routeCoords.length > 1) {
        await uploadRoute(user.id, activity.id, checkpoint.routeCoords).catch(() => {});
      }

      await SecureStore.deleteItemAsync(CHECKPOINT_KEY);
      return true;
    } catch (err) {
      console.warn('Orphan recovery failed:', err);
      return false;
    }
  }, []);

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    ...state,
    startSession,
    stopSession,
    recoverOrphanSession,
  };
}
