/**
 * activity.test.ts — MOV-08: Manual entry anti-cheat (supertest)
 *
 * Requirement coverage: MOV-08
 *   Manual treadmill entry: distance + duration, pace derived, anti-cheat server-validated.
 *   Reject impossible pace (> manual_max_speed_mph from game_config).
 *   Enforce daily mile cap (manual_entry_daily_cap from game_config).
 *
 * Endpoint: POST /activity/manual (apps/api/src/routes/activity.ts)
 *
 * Tests use the injectable ActivityDeps interface — no live Supabase connection.
 */

import request from 'supertest';
import express from 'express';
import { createActivityRouter, ActivityDeps } from '../src/routes/activity';

// ---------------------------------------------------------------------------
// Mock deps builder
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Record<string, number> = {
  manual_max_speed_mph: 15,
  manual_entry_daily_cap: 10,
  multiplier_walking: 1.0,
  multiplier_running: 1.25,
  pace_run_threshold_mpm: 12,
};

function buildDeps(overrides: Partial<{
  validUserId: string | null;
  configOverride: Record<string, number>;
  todayMiles: number;
  insertFails: boolean;
  insertId: string;
}>): ActivityDeps {
  const {
    validUserId = 'test-user-id',
    configOverride,
    todayMiles = 0,
    insertFails = false,
    insertId = 'activity-uuid-1',
  } = overrides;

  const config = { ...DEFAULT_CONFIG, ...(configOverride ?? {}) };

  return {
    validateToken: jest.fn(async (token: string) => {
      if (!validUserId || token === 'bad-token') return null;
      return { userId: validUserId };
    }),

    getConfig: jest.fn(async (_keys: string[]) => config),

    getTodayManualMiles: jest.fn(async (_userId: string) => todayMiles),

    insertActivity: jest.fn(async (_row) => {
      if (insertFails) throw new Error('DB insert failed');
      return { id: insertId };
    }),

    incrementMilesBanked: jest.fn(async (_userId: string, _miles: number) => {
      // no-op in tests
    }),
  };
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function buildApp(opts: Parameters<typeof buildDeps>[0] = {}) {
  const app = express();
  app.use(express.json());
  app.use('/activity', createActivityRouter(buildDeps(opts)));
  return app;
}

const VALID_TOKEN = 'valid-jwt-token';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /activity/manual — MOV-08 anti-cheat', () => {
  it('returns 401 when no auth token is provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/activity/manual')
      .send({ distanceMi: 2, durationMin: 30 });

    expect(res.status).toBe(401);
  });

  it('returns 401 when an invalid auth token is provided', async () => {
    const app = buildApp({ validUserId: null });
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', 'Bearer bad-token')
      .send({ distanceMi: 2, durationMin: 30 });

    expect(res.status).toBe(401);
  });

  it('returns 400 when distanceMi is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ durationMin: 30 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/distanceMi/);
  });

  it('returns 400 when durationMin is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/durationMin/);
  });

  it('returns 422 when derived pace exceeds manual_max_speed_mph (impossible pace)', async () => {
    // 5 miles in 10 minutes = 30 mph >> 15 mph cap
    const app = buildApp();
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 5, durationMin: 10 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IMPOSSIBLE_PACE');
  });

  it('returns 422 when daily miles already at or above manual_entry_daily_cap', async () => {
    // Already 10 miles today = exactly the cap
    const app = buildApp({ todayMiles: 10 });

    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 1, durationMin: 15 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DAILY_CAP_EXCEEDED');
  });

  it('returns 200 and credits miles when distance and pace are within limits (walking)', async () => {
    // 2 miles in 40 minutes = 3 mph, pace 20 min/mile → walking (1.0×)
    const app = buildApp({ todayMiles: 0 });
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 2, durationMin: 40 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.milesEarned).toBeCloseTo(2.0, 5); // walking 1.0×
    expect(res.body.multiplier).toBe(1.0);
  });

  it('returns 200 and applies running multiplier for fast pace', async () => {
    // 2 miles in 16 minutes = 7.5 mph, pace 8 min/mile → running (1.25×)
    const app = buildApp({ todayMiles: 0 });
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 2, durationMin: 16 });

    expect(res.status).toBe(200);
    expect(res.body.multiplier).toBe(1.25);
    expect(res.body.milesEarned).toBeCloseTo(2.5, 5); // 2 × 1.25
  });

  it('clamps distance to remaining daily cap when partial credit remains', async () => {
    // Already 8 miles, cap is 10 → 2 miles remaining
    const app = buildApp({ todayMiles: 8 });

    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 5, durationMin: 100 }); // 3 mph walking, 5 miles requested

    expect(res.status).toBe(200);
    // Only 2 miles should be credited (remaining cap)
    expect(res.body.rawDistanceMi).toBeCloseTo(2, 5);
    expect(res.body.milesEarned).toBeCloseTo(2, 5);
  });

  it('endpoint reads manual_max_speed_mph from game_config (not hardcoded)', async () => {
    // Config with a lower max speed to verify it is read from config
    const app = buildApp({
      configOverride: { manual_max_speed_mph: 5 }, // only 5 mph allowed
      todayMiles: 0,
    });

    // 2 miles in 15 minutes = 8 mph > 5 mph → should be rejected
    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 2, durationMin: 15 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IMPOSSIBLE_PACE');
  });

  it('endpoint reads manual_entry_daily_cap from game_config (not hardcoded)', async () => {
    // Config with a lower cap to verify it is read from config
    const app = buildApp({
      configOverride: { manual_entry_daily_cap: 3 }, // only 3 miles/day
      todayMiles: 3, // already at cap
    });

    const res = await request(app)
      .post('/activity/manual')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ distanceMi: 1, durationMin: 20 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DAILY_CAP_EXCEEDED');
  });
});
