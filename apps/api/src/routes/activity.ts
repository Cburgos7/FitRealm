/**
 * activity.ts — Manual entry anti-cheat endpoint (MOV-08)
 *
 * POST /activity/manual
 *   Body: { distanceMi: number, durationMin: number }
 *   Auth: Bearer JWT (Supabase auth)
 *
 * Validation (server-side only — client mileage is untrusted):
 *   1. Auth: Bearer JWT must be present — 401 if missing
 *   2. Input: distanceMi and durationMin required — 400 if missing/invalid
 *   3. Impossible pace: derived mph > manual_max_speed_mph from game_config → 422
 *   4. Daily cap: sum of today's manual miles + new miles >= manual_entry_daily_cap → 422
 *   5. Multiplier: derive from pace bands (walking/running only — no cycling/hiking indoors, D2-18)
 *
 * Security domain (T-02B-INF): server derives miles; never trusts client-sent mileage.
 */

import { Router, Request, Response } from 'express';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types for dependency injection
// ---------------------------------------------------------------------------

export interface ActivityDeps {
  /**
   * Validates a JWT token and returns the user id, or null if invalid.
   * In production: wraps supabase.auth.getUser(token).
   * In tests: returns a mock user id.
   */
  validateToken: (token: string) => Promise<{ userId: string } | null>;
  /**
   * Loads game_config values for the given keys.
   * Returns a key→number map (values are numeric game config).
   */
  getConfig: (keys: string[]) => Promise<Record<string, number>>;
  /**
   * Returns the total manual miles credited to userId today (from activities table).
   */
  getTodayManualMiles: (userId: string) => Promise<number>;
  /**
   * Inserts an activity row and returns the new activity id.
   */
  insertActivity: (row: {
    userId: string;
    activityKind: string;
    rawDistanceMi: number;
    multiplier: number;
    milesEarned: number;
    startedAt: string;
    endedAt: string;
  }) => Promise<{ id: string } | null>;
  /**
   * Increments profiles.miles_banked for the user.
   * Non-fatal if it fails.
   */
  incrementMilesBanked: (userId: string, miles: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Production deps factory (uses real Supabase service client)
// ---------------------------------------------------------------------------

export function createProductionDeps(): ActivityDeps {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async validateToken(token: string) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return null;
      return { userId: data.user.id };
    },

    async getConfig(keys: string[]) {
      const { data, error } = await admin
        .from('game_config')
        .select('key, value')
        .in('key', keys);
      if (error) throw new Error(`game_config read failed: ${error.message}`);
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[row.key] = parseFloat(row.value);
      }
      return map;
    },

    async getTodayManualMiles(userId: string) {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).toISOString();
      const { data, error } = await admin
        .from('activities')
        .select('miles_earned')
        .eq('user_id', userId)
        .eq('type', 'manual')
        .gte('created_at', startOfDay);
      if (error) throw new Error(`Daily total read failed: ${error.message}`);
      return (data ?? []).reduce((sum: number, r: { miles_earned: number }) => sum + (r.miles_earned ?? 0), 0);
    },

    async insertActivity(row) {
      const { data, error } = await admin
        .from('activities')
        .insert({
          user_id: row.userId,
          type: 'manual',
          activity_kind: row.activityKind,
          raw_distance_mi: row.rawDistanceMi,
          multiplier: row.multiplier,
          miles_earned: row.milesEarned,
          started_at: row.startedAt,
          ended_at: row.endedAt,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Activity insert failed: ${error.message}`);
      return data;
    },

    async incrementMilesBanked(userId: string, miles: number) {
      const { error } = await admin.rpc('increment_miles_banked', {
        p_user_id: userId,
        p_miles: miles,
      });
      if (error) {
        console.error('miles_banked increment failed:', error.message);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Router factory — accepts injectable deps for testing
// ---------------------------------------------------------------------------

export function createActivityRouter(deps?: ActivityDeps): Router {
  const router = Router();

  // Lazily initialise production deps when needed
  let resolvedDeps: ActivityDeps | null = deps ?? null;
  function getDeps(): ActivityDeps {
    if (!resolvedDeps) resolvedDeps = createProductionDeps();
    return resolvedDeps;
  }

  // --------------------------------------------------------------------------
  // POST /activity/manual
  // --------------------------------------------------------------------------

  router.post('/manual', async (req: Request, res: Response): Promise<void> => {
    const d = getDeps();

    // 1. Auth
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      res.status(401).json({ error: 'Missing authentication token' });
      return;
    }

    const authResult = await d.validateToken(token);
    if (!authResult) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { userId } = authResult;

    // 2. Input validation
    const { distanceMi, durationMin } = req.body as {
      distanceMi?: unknown;
      durationMin?: unknown;
    };

    if (distanceMi === undefined || distanceMi === null) {
      res.status(400).json({ error: 'distanceMi is required' });
      return;
    }

    if (durationMin === undefined || durationMin === null) {
      res.status(400).json({ error: 'durationMin is required' });
      return;
    }

    const distNum = Number(distanceMi);
    const durNum = Number(durationMin);

    if (isNaN(distNum) || isNaN(durNum)) {
      res.status(400).json({ error: 'distanceMi and durationMin must be numbers' });
      return;
    }

    if (distNum <= 0 || durNum <= 0) {
      res.status(400).json({ error: 'distanceMi and durationMin must be positive' });
      return;
    }

    // 3. Load game_config
    let config: Record<string, number>;
    try {
      config = await d.getConfig([
        'manual_max_speed_mph',
        'manual_entry_daily_cap',
        'multiplier_walking',
        'multiplier_running',
        'pace_run_threshold_mpm',
      ]);
    } catch {
      res.status(500).json({ error: 'Failed to load game config' });
      return;
    }

    const maxSpeedMph = config.manual_max_speed_mph ?? 15;
    const dailyCap = config.manual_entry_daily_cap ?? 10;
    const multiplierWalking = config.multiplier_walking ?? 1.0;
    const multiplierRunning = config.multiplier_running ?? 1.25;
    const paceRunThresholdMpm = config.pace_run_threshold_mpm ?? 12;

    // 4. Derive pace and check impossible speed
    const paceMinPerMile = durNum / distNum;
    const avgSpeedMph = 60 / paceMinPerMile;

    if (avgSpeedMph > maxSpeedMph) {
      res.status(422).json({
        error: `Pace is too fast for manual entry (${avgSpeedMph.toFixed(1)} mph > ${maxSpeedMph} mph max). Did you mean to use GPS tracking?`,
        code: 'IMPOSSIBLE_PACE',
      });
      return;
    }

    // 5. Daily cap check
    let todayTotal: number;
    try {
      todayTotal = await d.getTodayManualMiles(userId);
    } catch {
      res.status(500).json({ error: 'Failed to check daily total' });
      return;
    }

    if (todayTotal >= dailyCap) {
      res.status(422).json({
        error: `Daily manual entry cap reached (${dailyCap} miles/day). GPS tracking has no cap.`,
        code: 'DAILY_CAP_EXCEEDED',
        todayCredited: todayTotal,
        dailyCap,
      });
      return;
    }

    // Clamp to remaining cap
    const remainingCap = dailyCap - todayTotal;
    const creditableDistance = Math.min(distNum, remainingCap);

    // 6. Derive multiplier from pace bands (walking/running only — D2-18)
    const multiplier =
      paceMinPerMile <= paceRunThresholdMpm ? multiplierRunning : multiplierWalking;

    const milesEarned = creditableDistance * multiplier;
    const activityKind = paceMinPerMile <= paceRunThresholdMpm ? 'running' : 'walking';
    const endedAt = new Date().toISOString();
    const startedAt = new Date(Date.now() - durNum * 60 * 1000).toISOString();

    // 7. Insert activity row
    let activity: { id: string } | null;
    try {
      activity = await d.insertActivity({
        userId,
        activityKind,
        rawDistanceMi: creditableDistance,
        multiplier,
        milesEarned,
        startedAt,
        endedAt,
      });
    } catch {
      res.status(500).json({ error: 'Failed to record activity' });
      return;
    }

    // 8. Increment miles_banked (non-fatal)
    await d.incrementMilesBanked(userId, milesEarned);

    res.status(200).json({
      success: true,
      activityId: activity?.id,
      rawDistanceMi: creditableDistance,
      multiplier,
      milesEarned,
      todayCredited: todayTotal + milesEarned,
      dailyCap,
    });
  });

  return router;
}

// Default export: production deps, used by apps/api/src/index.ts
export default createActivityRouter();
