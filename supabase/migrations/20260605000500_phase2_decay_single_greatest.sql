-- =============================================================
-- Phase 2: Core Movement Loop — decay refactor: compute new food once (IN-03)
-- =============================================================
-- Migration: 20260605000500_phase2_decay_single_greatest.sql
--
-- Fixes IN-03: the original decay_village_food() evaluated
--   GREATEST(0, food - v_decay_rate)
-- three times inside one UPDATE (once for the food SET, twice in the
-- food_state CASE). Correct, but a future rate-formula change (e.g. the VLG-07
-- Watchtower modifier) would have to be edited in every copy. This refactor
-- computes the new food ONCE in a CTE/subselect, then derives both the stored
-- food and food_state from that single value — mirroring how allocate_food
-- computes v_new_food first.
--
-- Behaviour is unchanged:
--   * Only villages past their grace window decay (grace_expires_at < NOW()).
--   * Food is floored at 0 via GREATEST (balance invariant VLG-08 / T-02E-BAL).
--   * food_state thresholds identical: 0 → starving, <= hungry_threshold → hungry,
--     else thriving.
--   * last_decay_at / updated_at set to NOW() for each decayed village.
--
-- CREATE OR REPLACE is idempotent.
-- =============================================================

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
  -- Read tunable decay rate from game_config (T-02E-CFG / INFRA-02).
  SELECT value::numeric INTO v_decay_rate
  FROM   public.game_config WHERE key = 'food_decay_per_tick';

  SELECT value::numeric INTO v_hungry_threshold
  FROM   public.game_config WHERE key = 'food_hungry_threshold';

  -- Fall back to seeded defaults if config rows are unexpectedly missing.
  v_decay_rate       := COALESCE(v_decay_rate, 2.5);
  v_hungry_threshold := COALESCE(v_hungry_threshold, 20);

  -- ----------------------------------------------------------------
  -- Compute the post-decay food value ONCE per village (IN-03), then derive
  -- both the stored food and food_state from that single value.
  --
  -- Forward-compat hook (VLG-07 Watchtower, Phase 6): replace v_decay_rate in
  -- the `new_food` expression below with
  --   v_decay_rate * COALESCE(b.decay_modifier, 1.0)
  -- (joined from a future buildings table). Editing ONE expression now retunes
  -- the whole function. Balance invariant (VLG-08): effective decay MUST be > 0.
  --
  -- Only non-grace villages decay (grace_expires_at < NOW()); food floored at 0.
  -- ----------------------------------------------------------------
  WITH decayed AS (
    SELECT
      id,
      GREATEST(0, food - v_decay_rate) AS new_food
    FROM public.villages
    WHERE grace_expires_at < NOW()
  )
  UPDATE public.villages v
  SET
    food         = d.new_food,
    food_state   = CASE
                     WHEN d.new_food = 0                    THEN 'starving'
                     WHEN d.new_food <= v_hungry_threshold  THEN 'hungry'
                     ELSE 'thriving'
                   END,
    last_decay_at = NOW(),
    updated_at    = NOW()
  FROM decayed d
  WHERE v.id = d.id;

  -- VLG-09 Raiders are a distinct future threat axis — NOT handled here.
END;
$$;

GRANT EXECUTE ON FUNCTION public.decay_village_food() TO authenticated;

COMMENT ON FUNCTION public.decay_village_food() IS
  'Server-only 6-hour food decay tick (VLG-06). '
  'Computes post-decay food once per village via a CTE (IN-03), then derives '
  'food + food_state from it. Reads food_decay_per_tick + food_hungry_threshold '
  'from game_config. Skips villages still inside grace_expires_at (D2-25). '
  'Floors food at 0 (T-02E-BAL). Scheduled every 6h by pg_cron job food-decay-6h. '
  'VLG-07 Watchtower modifier hook ready for Phase 6.';
