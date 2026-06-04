/**
 * tracker.tsx — Full-screen GPS tracker screen (D2-10, MOV-01, MOV-02)
 *
 * Renders a full-screen Mapbox GL map with:
 *   - LocationPuck (user's current position)
 *   - ShapeSource + LineLayer route polyline (Pattern 2)
 *   - Green/yellow/red accuracy indicator dot (D2-12)
 *   - Pinned SessionStats bottom sheet
 *   - SessionSummary overlay after session ends
 *
 * GPS data comes from useGpsSession hook.
 * Navigates back to Move hub after banking.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGpsSession } from '@/hooks/useGpsSession';
import { SessionStats } from '@/components/move/SessionStats';
import { SessionSummary } from '@/components/move/SessionSummary';
import { ActivityKind } from '@/lib/activityDetector';

// ---------------------------------------------------------------------------
// Accuracy indicator colour (D2-12)
// ---------------------------------------------------------------------------

function accuracyColor(accuracyM: number | null): string {
  if (accuracyM === null) return '#888888'; // unknown
  if (accuracyM <= 5) return '#4caf50'; // green — excellent
  if (accuracyM <= 15) return '#ff9800'; // amber — acceptable
  return '#f44336'; // red — poor (but still below 20m threshold)
}

// ---------------------------------------------------------------------------
// Tracker screen
// ---------------------------------------------------------------------------

export default function TrackerScreen() {
  const insets = useSafeAreaInsets();
  const {
    isActive,
    distanceMi,
    elapsedSeconds,
    routeCoords,
    accuracyM,
    paceMinPerMile,
    startSession,
    stopSession,
  } = useGpsSession();

  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    distanceMi: number;
    activityKind: ActivityKind;
    multiplier: number;
    milesEarned: number;
  } | null>(null);

  // Auto-start session when screen mounts (user tapped "Start GPS Session")
  useEffect(() => {
    if (!isActive) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = async () => {
    const result = await stopSession();
    if (result) {
      setSummaryData({
        distanceMi: result.distanceMi,
        activityKind: result.result.kind,
        multiplier: result.result.multiplier,
        milesEarned: result.distanceMi * result.result.multiplier,
      });
      setSummaryVisible(true);
    } else {
      // No distance or bank failed — just navigate back
      router.back();
    }
  };

  const handleBank = () => {
    setSummaryVisible(false);
    Alert.alert(
      'Miles Banked!',
      `Your scouts return triumphant — ${summaryData?.milesEarned.toFixed(2) ?? '0'} miles banked for your village!`,
      [{ text: 'Excellent!', onPress: () => router.back() }],
    );
  };

  const handleDiscard = () => {
    setSummaryVisible(false);
    router.back();
  };

  // GeoJSON shape for the route polyline (Pattern 2)
  const routeShape: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: routeCoords.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoords,
            },
          },
        ]
      : [],
  };

  // Camera follows last known position
  const lastCoord = routeCoords[routeCoords.length - 1];
  const cameraCenter = lastCoord
    ? { latitude: lastCoord[1], longitude: lastCoord[0] }
    : undefined;

  return (
    <View style={styles.container}>
      {/* Full-screen Mapbox map
          @ts-ignore — @rnmapbox/maps types are not fully compatible with React 18 */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled={false}
        attributionEnabled={false}
      >
        {cameraCenter && (
          // @ts-ignore — Camera type mismatch with React 18
          <MapboxGL.Camera
            followUserLocation
            followZoomLevel={16}
            animationMode="easeTo"
            animationDuration={500}
          />
        )}

        {/* User position puck — @ts-ignore React 18 compat */}
        {/* @ts-ignore */}
        <MapboxGL.LocationPuck />

        {/* Route polyline (Pattern 2) */}
        {routeCoords.length >= 2 && (
          // @ts-ignore — ShapeSource children prop type mismatch with React 18
          <MapboxGL.ShapeSource id="route" shape={routeShape}>
            {/* @ts-ignore */}
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#4CAF50',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
        {/* @ts-ignore — closing tag for MapView */}
      </MapboxGL.MapView>

      {/* Accuracy indicator dot (D2-12) */}
      <View style={[styles.accuracyBadge, { top: insets.top + 12 }]}>
        <View
          style={[
            styles.accuracyDot,
            { backgroundColor: accuracyColor(accuracyM) },
          ]}
        />
        <Text style={styles.accuracyText}>
          {accuracyM !== null ? `${Math.round(accuracyM)}m` : '—'}
        </Text>
      </View>

      {/* Pinned bottom stats sheet */}
      {!summaryVisible && (
        <SessionStats
          distanceMi={distanceMi}
          paceMinPerMile={paceMinPerMile}
          elapsedSeconds={elapsedSeconds}
          onEnd={handleEnd}
        />
      )}

      {/* Post-session summary overlay */}
      {summaryVisible && summaryData && (
        <SessionSummary
          distanceMi={summaryData.distanceMi}
          activityKind={summaryData.activityKind}
          multiplier={summaryData.multiplier}
          milesEarned={summaryData.milesEarned}
          onBank={handleBank}
          onDiscard={handleDiscard}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  accuracyBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  accuracyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  accuracyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
