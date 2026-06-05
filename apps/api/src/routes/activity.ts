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

/**
 * WR-07: a UTC half-open window [startUtcMs, endUtcMs) representing the user's
 * LOCAL calendar day. Computed from the client's local-midnight day key and its
 * timezone offset so the manual daily-cap window matches the device-local day
 * used by day_credits (D2-08).
 */
export interface DayWindow {
  startUtcMs: number;
  endUtcMs: number;
}

/**
 * WR-07: build the device-local-day UTC window from a 'YYYY-MM-DD' local-midnight
 * day key and the device's Date#getTimezoneOffset() value (minutes to add to
 * local time to reach UTC). Returns null if the inputs are malformed so the
 * caller can fall back to the server-local day.
 *
 *   localMidnightUtcMs = Date.UTC(y, m-1, d) + tzOffsetMinutes * 60_000
 *
 * Example: UTC-8 (offset +480) on 2026-06-04 → 2026-06-04T08:00:00Z start,
 * 2026-06-05T08:00:00Z end — exactly the device's local calendar day.
 */
export function buildLocalDayWindow(
  dayKey: unknown,
  tzOffsetMinutes: unknown,
): DayWindow | null {
  if (typeof dayKey !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const offset = Number(tzOffsetMinutes);
  if (!Number.isFinite(offset)) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const startUtcMs = Date.UTC(y, m - 1, d) + offset * 60_000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return { startUtcMs, endUtcMs };
}

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
   * Returns the total manual miles credited to userId for the user's local
   * "today" (from the activities table).
   *
   * WR-07: `dayWindow` carries the device-local day boundaries (as UTC instants)
   * derived from the client's local-midnight day key + timezone offset, so the
   * cap window matches the client's `day_credits` bookkeeping (D2-08) instead of
   * the server's UTC wall clock. When omitted (e.g. older clients / tests), the
   * implementation falls back to the server-local calendar day.
   */
  getTodayManualMiles: (userId: string, dayWindow?: DayWindow) => Promise<number>;
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
   * CR-01/WR-04: throws on failure so the route can return an error status
   * instead of reporting success while the bank was never credited.
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

    async getTodayManualMiles(userId: string, dayWindow?: DayWindow) {
      // WR-07: prefer the client's device-local day window so the cap resets at
      // the user's local midnight (consistent with day_credits). Fall back to
      // the server-local calendar day when the client did not supply a window.
      let startIso: string;
      let endIso: string | null = null;
      if (dayWindow) {
        startIso = new Date(dayWindow.startUtcMs).toISOString();
        endIso = new Date(dayWindow.endUtcMs).toISOString();
      } else {
        const today = new Date();
        startIso = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        ).toISOString();
      }

      let q = admin
        .from('activities')
        .select('miles_earned')
        .eq('user_id', userId)
        .eq('type', 'manual')
        .gte('created_at', startIso);
      if (endIso) q = q.lt('created_at', endIso);

      const { data, error } = await q;
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
        // CR-01/WR-04: surface the failure so the route does not report
        // success while the bank was never credited.
        throw new Error(`miles_banked increment failed: ${error.message}`);
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
    const { distanceMi, durationMin, dayKey, tzOffsetMinutes } = req.body as {
      distanceMi?: unknown;
      durationMin?: unknown;
      // WR-07: device-local day key ('YYYY-MM-DD') + Date#getTimezoneOffset()
      // so the daily cap window matches the user's local day (D2-08).
      dayKey?: unknown;
      tzOffsetMinutes?: unknown;
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

    // 5. Daily cap check — use the device-local day window when the client
    //    provided one (WR-07), else fall back to the server-local day.
    const dayWindow = buildLocalDayWindow(dayKey, tzOffsetMinutes) ?? undefined;
    let todayTotal: number;
    try {
      todayTotal = await d.getTodayManualMiles(userId, dayWindow);
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

    // 6. Derive multiplier from pace bands (walking/running only — D2-18)
    const multiplier =
      paceMinPerMile <= paceRunThresholdMpm ? multiplierRunning : multiplierWalking;

    // CR-03: enforce the daily cap on the FINAL credited miles (post-multiplier),
    // not on raw distance. Clamping raw distance let milesEarned = distance ×
    // multiplier overshoot the cap whenever multiplier > 1 (e.g. running 1.25×:
    // 10 raw mi under a 10-mile cap banked 12.5 miles). We compute the uncapped
    // earned miles, clamp THAT to the remaining cap, then derive the stored raw
    // distance back from the credited miles so the row stays internally
    // consistent (rawDistance × multiplier === milesEarned).
    const remainingCap = Math.max(0, dailyCap - todayTotal);
    const milesEarnedRaw = distNum * multiplier;
    const milesEarned = Math.min(milesEarnedRaw, remainingCap);
    const creditableDistance = multiplier > 0 ? milesEarned / multiplier : 0;

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

    // 8. Increment miles_banked — CR-01/WR-04: fatal. If crediting the bank
    //    fails we must NOT report success, otherwise the activity row counts
    //    against the daily cap while the user never received the miles.
    try {
      await d.incrementMilesBanked(userId, milesEarned);
    } catch {
      res.status(500).json({ error: 'Activity recorded but crediting miles failed. Please retry.' });
      return;
    }

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
