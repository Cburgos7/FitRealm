-- =============================================================
-- Phase 2: Core Movement Loop — increment_miles_banked RPC (CR-01 fix)
-- =============================================================
-- Migration: 20260605000000_phase2_increment_miles_fix.sql
--
-- Fixes CR-01: the mobile GPS/passive paths and the manual-entry API all call
--   supabase.rpc('increment_miles_banked', { p_user_id, p_miles }) but the
--   function was defined in NO migration, so every mile-banking path failed at
--   runtime (PostgREST PGRST202 "function not found"). The central Move → Bank
--   loop never credited profiles.miles_banked.
--
-- Design:
--   * Signature matches the four call sites exactly: (p_user_id uuid, p_miles numeric).
--   * Credits the canonical bank: profiles.miles_banked (villages.miles_banked is
--     reserved/unused per the schema header — IN-05).
--   * Atomic: SELECT … FOR UPDATE row-locks the profile before the UPDATE so
--     concurrent banking calls for the same user serialize (no lost update).
--   * SECURITY DEFINER so it runs as the owning role and can update the row, but
--     it still enforces ownership: an authenticated client may only credit its
--     OWN profile (auth.uid() = p_user_id). The service-role path (manual-entry
--     API) has auth.uid() = NULL and is allowed (server is trusted, derives miles
--     server-side).
--   * Returns the new balance so callers can verify the credit landed.
-- =============================================================

CREATE OR REPLACE FUNCTION public.increment_miles_banked(
  p_user_id uuid,
  p_miles   numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid;
  v_new_total numeric;
BEGIN
  -- Reject obviously bad input early.
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'increment_miles_banked: p_user_id is required';
  END IF;
  IF p_miles IS NULL OR p_miles <= 0 THEN
    RAISE EXCEPTION 'increment_miles_banked: p_miles must be a positive number (got %)', p_miles;
  END IF;

  -- Ownership guard. auth.uid() is NULL for the service-role (trusted server)
  -- path; for the authenticated client path it MUST match the target profile.
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'increment_miles_banked: caller % may not credit profile %', v_caller, p_user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Row-lock the profile so concurrent banking calls for the same user
  -- serialize (no lost update on profiles.miles_banked).
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'increment_miles_banked: profile % not found', p_user_id;
  END IF;

  UPDATE public.profiles
  SET    miles_banked = miles_banked + p_miles,
         updated_at   = NOW()
  WHERE  id = p_user_id
  RETURNING miles_banked INTO v_new_total;

  RETURN v_new_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_miles_banked(uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.increment_miles_banked(uuid, numeric) IS
  'Atomically add p_miles to profiles.miles_banked under a FOR UPDATE row lock. '
  'SECURITY DEFINER; enforces ownership (authenticated callers may only credit '
  'their own profile; service-role/auth.uid()=NULL is trusted). Returns the new '
  'miles_banked total. Fixes CR-01 (function was previously undefined).';
