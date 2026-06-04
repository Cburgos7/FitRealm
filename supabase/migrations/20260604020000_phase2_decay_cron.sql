-- =============================================================
-- Phase 2: Core Movement Loop — Food Decay via pg_cron
-- =============================================================
-- Migration: 20260604020000_phase2_decay_cron.sql
-- Adds: public.decay_village_food() Postgres function
--       pg_cron job 'food-decay-6h' (0 */6 * * *)
--
-- WHY pg_cron NOT Vercel Cron (Pitfall 1 / Open Question 2):
--   Vercel Hobby plan limits cron jobs to once per day.
--   [VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing]
--   The 6-hour decay tick requires Vercel Pro ($20/mo) OR Supabase
--   pg_cron (free, runs inside Postgres, zero network hop for the UPDATE).
--   Use pg_cron. Vercel API handles only the manual-entry anti-cheat
--   endpoint (request-driven, not cron-driven).
--
-- SECURITY MODEL:
--   T-02E-CLI  : Decay runs ONLY in this function via pg_cron.
--                The client NEVER mutates food on a timer (VLG-06 /
--                CLAUDE.md decay-is-server-only invariant).
--   T-02E-DOS  : pg_cron is internal to Postgres — no HTTP endpoint
--                is exposed for decay (contrast with Vercel cron which
--                would expose a public URL).
--   T-02E-CFG  : Rate read from game_config inside the function;
--                the client cannot change it (game_config is
--                SELECT-only RLS, Plan A T-02-04).
--   T-02E-BAL  : Decay applies to ALL non-grace villages with no
--                zero-decay path. The WHERE clause is
--                grace_expires_at < NOW() — every village past its
--                grace window loses food. GREATEST(0, ...) floors at 0
--                only; it never skips (VLG-08 balance invariant).
--
-- FORWARD-COMPAT HOOKS (NOT implemented here):
--   VLG-07 Watchtower building modifier (Phase 6):
--     When buildings ship, replace the bare v_decay_rate read with:
--       effective_decay := v_decay_rate
--                          * COALESCE(building_modifier, 1.0)
--     where `building_modifier` is joined from a future `buildings`
--     table. The balance invariant (VLG-08) MUST hold:
--       effective_decay > 0 even at max Watchtower level.
--       Buildings buy time, not freedom from movement.
--
--   VLG-09 Raiders (future threat axis, distinct from decay):
--     Raider attacks are NOT a decay event. They are a separate combat
--     system with its own tick/trigger and are NOT implemented here.
--     Do not add raider logic to this function.
--
-- ASSUMPTION A3 FALLBACK (pg_cron availability):
--   CREATE EXTENSION IF NOT EXISTS pg_cron should enable pg_cron on the
--   free tier. If the Supabase platform blocks the extension (e.g., a
--   plan restriction), the client-side fallback is a call to
--   `supabase.rpc('decay_village_food')` on app foreground — this
--   preserves server-authoritativeness (the function still runs in
--   Postgres; only the schedule trigger changes). Document A3 status
--   in the 02-05-SUMMARY.md Deferred punch-list.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Enable pg_cron extension (once; idempotent)
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -------------------------------------------------------------
-- 2. decay_village_food() — server-only food decay function
--
--    Decrements food by food_decay_per_tick (from game_config)
--    for every village past its grace window.
--    Floors food at 0 via GREATEST(0, ...).
--    Recomputes food_state (thriving / hungry / starving).
--    Skips villages still in the 24h grace window (VLG-06/D2-25).
--    Sets last_decay_at = NOW() for each decayed village.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decay_village_food()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate        numeric;
  v_hungry_threshold  numeric;
BEGIN
  -- ----------------------------------------------------------------
  -- Read tunable decay rate from game_config (T-02E-CFG / INFRA-02).
  -- Nothing is hardcoded; product can retune without a code deploy.
  -- ----------------------------------------------------------------
  SELECT value::numeric
  INTO   v_decay_rate
  FROM   public.game_config
  WHERE  key = 'food_decay_per_tick';

  SELECT value::numeric
  INTO   v_hungry_threshold
  FROM   public.game_config
  WHERE  key = 'food_hungry_threshold';

  -- Fall back to seeded defaults if config rows are unexpectedly missing
  v_decay_rate       := COALESCE(v_decay_rate, 2.5);
  v_hungry_threshold := COALESCE(v_hungry_threshold, 20);

  -- ----------------------------------------------------------------
  -- Forward-compat hook: VLG-07 Watchtower building modifier (Phase 6)
  --
  --   When the Watchtower building ships, insert here:
  --     JOIN public.buildings b ON b.village_id = v.id AND b.type = 'watchtower'
  --   and use:
  --     effective_decay := v_decay_rate * COALESCE(b.decay_modifier, 1.0)
  --   in the SET clause below instead of the bare v_decay_rate.
  --
  --   Balance invariant (VLG-08): effective_decay MUST remain > 0.
  --   The Watchtower reduces the rate — it does not zero it.
  --   A fully maxed village still loses food every tick.
  -- ----------------------------------------------------------------

  -- ----------------------------------------------------------------
  -- Apply decay to all villages past their grace period (VLG-06/D2-25).
  --   WHERE grace_expires_at < NOW()
  --   ↳ villages still inside their 24h window are skipped entirely.
  --
  -- Balance invariant (VLG-08/T-02E-BAL):
  --   Every non-grace village loses food — there is no zero-decay path.
  --   GREATEST(0, food - v_decay_rate) floors at 0 but never skips.
  --
  -- food_state is recomputed inline using the same CASE thresholds
  -- as allocate_food() (Plan D) for consistency (D2-02):
  --   starving : new food  = 0
  --   hungry   : new food <= food_hungry_threshold (and > 0)
  --   thriving : new food  > food_hungry_threshold
  -- ----------------------------------------------------------------
  UPDATE public.villages
  SET
    food         = GREATEST(0, food - v_decay_rate),
    food_state   = CASE
                     WHEN GREATEST(0, food - v_decay_rate) = 0
                       THEN 'starving'
                     WHEN GREATEST(0, food - v_decay_rate) <= v_hungry_threshold
                       THEN 'hungry'
                     ELSE 'thriving'
                   END,
    last_decay_at = NOW(),
    updated_at    = NOW()
  WHERE grace_expires_at < NOW();

  -- VLG-09 Raiders (future, NOT here):
  --   Raider attacks are a distinct threat axis with their own
  --   tick/trigger. They are NOT a decay event and are NOT handled
  --   in this function. See Phase 6 for the raider system.

END;
$$;

-- Grant execute to authenticated role (PostgREST + pg_cron both need it)
GRANT EXECUTE ON FUNCTION public.decay_village_food() TO authenticated;

COMMENT ON FUNCTION public.decay_village_food() IS
  'Server-only 6-hour food decay tick (VLG-06). '
  'Reads food_decay_per_tick + food_hungry_threshold from game_config. '
  'Skips villages still inside their grace_expires_at window (D2-25). '
  'Floors food at 0 via GREATEST(0,...) (T-02E-BAL). '
  'Recomputes food_state (thriving/hungry/starving). '
  'Scheduled every 6h by pg_cron job food-decay-6h. '
  'VLG-07 Watchtower modifier hook ready for Phase 6. '
  'VLG-09 Raiders are a separate future system — not here.';

-- -------------------------------------------------------------
-- 3. Schedule the decay function every 6 hours via pg_cron
--    (NOT Vercel Cron — see file header for rationale)
--
--    Idempotent: cron.schedule with the same name replaces the
--    existing job rather than creating a duplicate.
-- -------------------------------------------------------------
SELECT cron.schedule(
  'food-decay-6h',       -- job name (unique; replaces existing if re-run)
  '0 */6 * * *',         -- every 6 hours at :00 (00:00, 06:00, 12:00, 18:00 UTC)
  'SELECT public.decay_village_food()'
);
