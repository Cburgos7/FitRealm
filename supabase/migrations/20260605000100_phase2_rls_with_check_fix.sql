-- =============================================================
-- Phase 2: Core Movement Loop — RLS WITH CHECK fix (CR-02)
-- =============================================================
-- Migration: 20260605000100_phase2_rls_with_check_fix.sql
--
-- Fixes CR-02: activities_own and allocations_own were declared as
--   CREATE POLICY ... FOR ALL USING (auth.uid() = user_id)
-- with NO WITH CHECK clause. For a FOR ALL policy, USING filters
-- SELECT/UPDATE/DELETE rows, but INSERT is governed by WITH CHECK. With no
-- WITH CHECK, Postgres applies NO check on INSERT, so an authenticated client
-- could INSERT activities/allocations rows for ANY user_id (cross-user spoof)
-- or self-insert arbitrary miles_earned — a direct anti-cheat bypass.
--
-- This migration drops and recreates both policies with an explicit
-- WITH CHECK (auth.uid() = user_id) so a client can only write rows it owns.
-- SELECT/UPDATE/DELETE remain scoped to auth.uid() via USING.
--
-- NOTE: This still lets a client insert any miles_earned for their OWN user_id.
-- Moving mile-earning fully behind a SECURITY DEFINER RPC that derives miles
-- server-side (mirroring the manual-entry endpoint) is the deeper fix and is
-- tracked as a follow-up — out of scope for this RLS hardening pass.
-- =============================================================

-- ----- activities -----
DROP POLICY IF EXISTS activities_own ON public.activities;
CREATE POLICY activities_own ON public.activities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----- allocations -----
DROP POLICY IF EXISTS allocations_own ON public.allocations;
CREATE POLICY allocations_own ON public.allocations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
