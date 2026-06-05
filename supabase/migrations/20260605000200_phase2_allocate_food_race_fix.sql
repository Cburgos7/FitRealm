-- =============================================================
-- Phase 2: Core Movement Loop — allocate_food idempotency race fix (CR-04)
-- =============================================================
-- Migration: 20260605000200_phase2_allocate_food_race_fix.sql
--
-- Fixes CR-04: the original allocate_food ran the idempotency EXISTS check
-- BEFORE the FOR UPDATE lock on profiles. Two concurrent calls with the SAME
-- idempotency key (e.g. the optimistic online call racing the offline-queue
-- replay after a flaky reconnect) could both pass the NOT EXISTS check, both
-- acquire the profile lock sequentially, both deduct miles and add food, and
-- then the second INSERT … idempotency_key UNIQUE would raise an UNHANDLED
-- exception — after miles had already been double-deducted in that aborted
-- transaction, and returning a 500 to the client instead of idempotent:true.
--
-- This CREATE OR REPLACE:
--   1. Acquires the profiles FOR UPDATE lock FIRST, serializing same-user calls.
--   2. Re-checks idempotency UNDER the lock (so a committed prior call with the
--      same key is seen) and early-returns idempotent:true.
--   3. Wraps the miles deduction + food add + allocation INSERT so that a
--      unique_violation on idempotency_key (a replay that committed between the
--      check and the insert) is caught and returned as idempotent:true with NO
--      net spend — the exception rolls back this block's writes.
--
-- Behaviour is otherwise identical to the original (server-authoritative
-- balance check, config-driven food cap/threshold, instant starving unlock).
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
  v_current_miles         numeric;
  v_food_cap              numeric;
  v_food_hungry_threshold numeric;
  v_village_id            uuid;
  v_new_food              numeric;
  v_new_state             text;
BEGIN
  -- ----------------------------------------------------------------
  -- 1. Lock the profile row FIRST. FOR UPDATE serialises simultaneous
  --    allocate_food calls for the same user (rapid double-tap /
  --    optimistic-vs-replay race). All idempotency reasoning happens
  --    AFTER this lock so a committed prior call is always visible.
  --    T-02D-RACE / ALLOC-05 / CR-04
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
  -- 2. Idempotency check, now UNDER the profile lock (CR-04). A prior
  --    committed call with this key returns success without re-spending.
  --    T-02D-RPY
  -- ----------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM public.allocations
    WHERE idempotency_key = p_idempotency_key
  ) THEN
    RETURN json_build_object('success', true, 'idempotent', true);
  END IF;

  -- ----------------------------------------------------------------
  -- 3. Server-authoritative balance check (T-02D-OVS / ALLOC-03).
  -- ----------------------------------------------------------------
  IF v_current_miles < p_miles_cost THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_miles');
  END IF;

  -- ----------------------------------------------------------------
  -- 4. Read tunable values from game_config (T-02D-CFG / INFRA-02).
  -- ----------------------------------------------------------------
  SELECT value::numeric INTO v_food_cap
  FROM   public.game_config
  WHERE  key = 'food_cap';

  SELECT value::numeric INTO v_food_hungry_threshold
  FROM   public.game_config
  WHERE  key = 'food_hungry_threshold';

  v_food_cap              := COALESCE(v_food_cap, 100);
  v_food_hungry_threshold := COALESCE(v_food_hungry_threshold, 20);

  -- Resolve the owner's village up front (needed for the INSERT below).
  SELECT id INTO v_village_id
  FROM   public.villages
  WHERE  owner_id = p_user_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'village_not_found');
  END IF;

  -- ----------------------------------------------------------------
  -- 5. Spend + record as one unit. If a concurrent replay with the same
  --    idempotency key committed between the EXISTS check (step 2) and
  --    this INSERT, the UNIQUE constraint raises unique_violation; we
  --    catch it and return idempotent:true. The miles deduction and food
  --    add in this sub-block roll back with the failed INSERT, so the
  --    replay produces NO net spend. CR-04.
  -- ----------------------------------------------------------------
  BEGIN
    -- Deduct miles from the owner's profile (already row-locked).
    UPDATE public.profiles
    SET    miles_banked = miles_banked - p_miles_cost,
           updated_at   = NOW()
    WHERE  id = p_user_id;

    -- Compute capped new food + derived state.
    SELECT LEAST(v_food_cap, food + p_food_gain)
    INTO   v_new_food
    FROM   public.villages
    WHERE  id = v_village_id;

    v_new_state := CASE
      WHEN v_new_food <= 0                        THEN 'starving'
      WHEN v_new_food <= v_food_hungry_threshold  THEN 'hungry'
      ELSE 'thriving'
    END;

    UPDATE public.villages
    SET    food       = v_new_food,
           food_state = v_new_state,
           updated_at = NOW()
    WHERE  id = v_village_id;

    -- Record the allocation (idempotency_key UNIQUE is the backstop).
    INSERT INTO public.allocations
      (user_id, village_id, action, miles_cost, resource_gain, idempotency_key)
    VALUES
      (p_user_id, v_village_id, 'hunt_food', p_miles_cost, p_food_gain, p_idempotency_key);
  EXCEPTION
    WHEN unique_violation THEN
      -- A replay of the same intent committed concurrently. The writes in
      -- this block are rolled back; return success as idempotent (no double
      -- spend).
      RETURN json_build_object('success', true, 'idempotent', true);
  END;

  RETURN json_build_object('success', true, 'idempotent', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_food(uuid, numeric, numeric, text)
  TO authenticated;

COMMENT ON FUNCTION public.allocate_food(uuid, numeric, numeric, text) IS
  'Atomically deduct miles from profiles.miles_banked and add food to the '
  'owner''s village. Locks the profile FOR UPDATE FIRST, then checks idempotency '
  'under the lock and catches unique_violation on replay (CR-04 race fix). '
  'Reads food_cap + food_hungry_threshold from game_config. Instantly unlocks a '
  'starving village (VLG-05).';
