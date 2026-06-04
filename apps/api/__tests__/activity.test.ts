/**
 * activity.test.ts — MOV-08: Manual entry anti-cheat (supertest)
 *
 * Requirement coverage: MOV-08
 *   Manual treadmill entry: distance + duration, pace derived, anti-cheat server-validated.
 *   Reject impossible pace (> manual_max_speed_mph from game_config).
 *   Enforce daily mile cap (manual_entry_daily_cap from game_config).
 *
 * Endpoint: POST /activity/manual (Vercel API — apps/api/src/routes/activity.ts)
 * Implemented in: Plan B (02-02)
 *
 * MISSING — implemented in Plan B
 */

// Placeholder scaffolds — Plan B (02-02) fills these in.
describe('POST /activity/manual — MOV-08 anti-cheat', () => {
  it.todo('returns 400 when derived pace exceeds manual_max_speed_mph');
  it.todo('returns 400 when daily miles already at or above manual_entry_daily_cap');
  it.todo('returns 200 and credits miles when distance and pace are within limits');
  it.todo('requires valid auth JWT — returns 401 without token');
  it.todo('rejects missing required fields (distance, duration)');
});
