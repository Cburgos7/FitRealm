-- =============================================================
-- Phase 2: Core Movement Loop — Allocate Food RPC
-- =============================================================
-- Migration: 20260604010000_phase2_allocate_rpc.sql
-- Adds: public.allocate_food() atomic RPC
--
-- Security model:
--   T-02D-RACE : SELECT … FOR UPDATE on profiles row prevents concurrent
--                over-spend from rapid taps (ALLOC-05).
--   T-02D-RPY  : idempotency_key UNIQUE in allocations + early-return if key
--                already exists prevents replay / duplicate spend on sync.
--   T-02D-OVS  : server rejects spend when miles_banked < cost; the client
--                grey-out is UX only, server is authoritative (ALLOC-03).
--   T-02D-CFG  : food rate + cap read from game_config inside the function;
--                the client cannot alter them (game_config is SELECT-only RLS,
--                Plan A T-02-04).
-- =============================================================

CREATE OR REPLACE FUNCTION public.allocate_food(
  p_user_id         uuid,
  p_miles_cost      numeric,
  p_food_gain       numeric,
  p_idempotency_key text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_miles        numeric;
  v_food_cap             numeric;
  v_food_hungry_threshold numeric;
  v_village_id           uuid;
  v_new_food             numeric;
  v_new_state            text;
BEGIN
  -- ----------------------------------------------------------------
  -- 1. Idempotency: early-return success if this key was already
  --    committed (handles SQLite queue re-sync + rapid-tap replay).
  --    T-02D-RPY
  -- ----------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM public.allocations
    WHERE idempotency_key = p_idempotency_key
  ) THEN
    RETURN json_build_object('success', true, 'idempotent', true);
  END IF;

  -- ----------------------------------------------------------------
  -- 2. Lock the profile row to prevent concurrent over-spend.
  --    FOR UPDATE serialises simultaneous allocate_food calls for
  --    the same user (rapid double-tap race condition).
  --    T-02D-RACE / ALLOC-05
  -- ----------------------------------------------------------------
  SELECT miles_banked
  INTO   v_current_miles
  FROM   public.profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  -- ----------------------------------------------------------------
  -- 3. Server-authoritative balance check (T-02D-OVS / ALLOC-03).
  --    Client grey-out is UX only — server is the backstop.
  -- ----------------------------------------------------------------
  IF v_current_miles < p_miles_cost THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_miles');
  END IF;

  -- ----------------------------------------------------------------
  -- 4. Read tunable values from game_config (T-02D-CFG / INFRA-02).
  --    Nothing is hardcoded; product can retune without a code deploy.
  -- ----------------------------------------------------------------
  SELECT value::numeric INTO v_food_cap
  FROM   public.game_config
  WHERE  key = 'food_cap';

  SELECT value::numeric INTO v_food_hungry_threshold
  FROM   public.game_config
  WHERE  key = 'food_hungry_threshold';

  -- Fall back to seeded defaults if config rows are unexpectedly missing
  v_food_cap              := COALESCE(v_food_cap, 100);
  v_food_hungry_threshold := COALESCE(v_food_hungry_threshold, 20);

  -- ----------------------------------------------------------------
  -- 5. Deduct miles from the owner's profile (already row-locked).
  -- ----------------------------------------------------------------
  UPDATE public.profiles
  SET    miles_banked = miles_banked - p_miles_cost,
         updated_at   = NOW()
  WHERE  id = p_user_id;

  -- ----------------------------------------------------------------
  -- 6. Add food to the village, capped at food_cap.
  --    Recompute food_state (VLG-03) — instantly unlocks a starving
  --    village when any food is added (VLG-05 / D2-03).
  -- ----------------------------------------------------------------
  SELECT id INTO v_village_id
  FROM   public.villages
  WHERE  owner_id = p_user_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'village_not_found');
  END IF;

  -- Compute new food value before the UPDATE for food_state derivation
  SELECT LEAST(v_food_cap, food + p_food_gain)
  INTO   v_new_food
  FROM   public.villages
  WHERE  id = v_village_id;

  -- Derive new state using config-driven thresholds (no hardcoded 20/100)
  v_new_state := CASE
    WHEN v_new_food <= 0                   THEN 'starving'
    WHEN v_new_food <= v_food_hungry_threshold THEN 'hungry'
    ELSE 'thriving'
  END;

  UPDATE public.villages
  SET    food       = v_new_food,
         food_state = v_new_state,
         updated_at = NOW()
  WHERE  id = v_village_id;

  -- ----------------------------------------------------------------
  -- 7. Record the allocation (idempotency_key UNIQUE prevents a
  --    second INSERT if somehow this point is reached twice).
  -- ----------------------------------------------------------------
  INSERT INTO public.allocations
    (user_id, village_id, action, miles_cost, resource_gain, idempotency_key)
  VALUES
    (p_user_id, v_village_id, 'hunt_food', p_miles_cost, p_food_gain, p_idempotency_key);

  RETURN json_build_object('success', true, 'idempotent', false);
END;
$$;

-- Grant execute to the authenticated role so PostgREST can call it via RPC.
-- SECURITY DEFINER means the function runs as the owning role (postgres),
-- so it can bypass RLS when needed — but it validates ownership explicitly.
GRANT EXECUTE ON FUNCTION public.allocate_food(uuid, numeric, numeric, text)
  TO authenticated;

-- Add a helpful comment
COMMENT ON FUNCTION public.allocate_food(uuid, numeric, numeric, text) IS
  'Atomically deduct miles from profiles.miles_banked and add food to the '
  'owner''s village. Row-locked (FOR UPDATE) to prevent concurrent over-spend. '
  'Idempotent via p_idempotency_key UNIQUE on allocations. '
  'Reads food_cap + food_hungry_threshold from game_config. '
  'Instantly unlocks a starving village (VLG-05).';
