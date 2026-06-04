/**
 * routeUpload.ts — Upload completed GPS route as GeoJSON to Supabase Storage
 *
 * Uses the base64-arraybuffer pattern (not Blob/File/FormData) because
 * React Native does not support those with Supabase Storage. (Pitfall 3)
 *
 * Path: `${userId}/${activityId}.geojson`
 * Bucket: 'routes' (created in Phase 2 migration with own-folder RLS)
 * Content-Type: 'application/geo+json'
 */

import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

/** GeoJSON LineString FeatureCollection built from [lon, lat] coords */
function buildGeoJson(coords: [number, number][]): string {
  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      },
    ],
  };
  return JSON.stringify(featureCollection);
}

/**
 * Upload a GPS route to the 'routes' Supabase Storage bucket.
 *
 * @param userId     Authenticated user UUID (scopes the storage path)
 * @param activityId UUID of the activities row (used as filename)
 * @param coords     Array of [longitude, latitude] coordinates
 */
export async function uploadRoute(
  userId: string,
  activityId: string,
  coords: [number, number][],
): Promise<void> {
  if (coords.length < 2) {
    throw new Error('Route must have at least 2 coordinates to upload');
  }

  const geojsonStr = buildGeoJson(coords);
  // btoa encodes to base64; decode converts to ArrayBuffer
  const base64 = btoa(unescape(encodeURIComponent(geojsonStr)));
  const buffer = decode(base64);

  const path = `${userId}/${activityId}.geojson`;

  const { error } = await supabase.storage.from('routes').upload(path, buffer, {
    contentType: 'application/geo+json',
    upsert: false,
  });

  if (error) {
    throw new Error(`Route upload failed: ${error.message}`);
  }
}
