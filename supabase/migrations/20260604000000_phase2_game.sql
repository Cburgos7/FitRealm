-- =============================================================
-- Phase 2: Core Movement Loop — Game Schema
-- =============================================================
-- Migration: 20260604000000_phase2_game.sql
-- Adds: food/state/grace columns on villages, profiles.miles_banked,
--       activities table, allocations table, game_config table + RLS + seed
--       Supabase Storage 'routes' bucket + RLS policies
--
-- NOTE: VLG-07 (Watchtower building modifier) is a Phase 6 concern.
--   When buildings ship, decay_village_food() should read a per-village
--   modifier from a future `buildings` table and apply:
--     effective_decay = base_decay * COALESCE(building_modifier, 1.0)
--   The balance invariant (VLG-08) MUST hold: effective_decay > 0 even at
--   max building level. Buildings buy time, not freedom from movement.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Extend public.villages with Phase 2 columns
-- -------------------------------------------------------------
ALTER TABLE public.villages
  ADD COLUMN IF NOT EXISTS food              numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS food_state        text    NOT NULL DEFAULT 'thriving'
    CONSTRAINT villages_food_state_check CHECK (food_state IN ('thriving', 'hungry', 'starving')),
  ADD COLUMN IF NOT EXISTS miles_banked      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medicine          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wood              numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stone             numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morale            numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  ADD COLUMN IF NOT EXISTS last_decay_at     timestamptz;

-- -------------------------------------------------------------
-- 2. Add miles_banked to public.profiles (canonical Mile Bank)
--    villages.miles_banked is reserved / unused — canonical is here.
-- -------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS miles_banked numeric NOT NULL DEFAULT 0;

-- -------------------------------------------------------------
-- 3. activities table  (GPS sessions, manual entries, passive reads)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  type            text        NOT NULL CHECK (type IN ('gps', 'manual', 'passive')),
  activity_kind   text        CHECK (activity_kind IN ('walking', 'running', 'cycling', 'hiking')),
  raw_distance_mi numeric     NOT NULL,
  multiplier      numeric     NOT NULL DEFAULT 1.0,
  miles_earned    numeric     NOT NULL,
  route_url       text,                      -- Supabase Storage path for GeoJSON (MOV-03)
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- T-02-ID: owner-scoped RLS — users see/modify only their own activities
CREATE POLICY activities_own ON public.activities
  FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 4. allocations table  (Hunt Food, Gather, Defend, etc.)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allocations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  village_id      uuid        NOT NULL REFERENCES public.villages ON DELETE CASCADE,
  action          text        NOT NULL,
  miles_cost      numeric     NOT NULL,
  resource_gain   numeric     NOT NULL,
  idempotency_key text        UNIQUE,        -- prevents double-spend on rapid taps
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

-- T-02-ID: owner-scoped RLS
CREATE POLICY allocations_own ON public.allocations
  FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 5. game_config table  (INFRA-02: ALL balance values live here)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_config (
  key         text        PRIMARY KEY,
  value       text        NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

-- T-02-04: SELECT-only policy for authenticated clients.
-- No INSERT/UPDATE/DELETE policy for clients — they can read but never alter balance.
CREATE POLICY game_config_read ON public.game_config
  FOR SELECT USING (true);

-- -------------------------------------------------------------
-- 6. Seed game_config (all tunable values — INFRA-02)
--    ON CONFLICT DO NOTHING ensures re-runnable migrations.
-- -------------------------------------------------------------
INSERT INTO public.game_config (key, value, description) VALUES
  -- Food economy
  ('food_decay_per_tick',     '2.5',    'Food deducted per 6-hour decay tick (VLG-06)'),
  ('food_decay_cadence_h',    '6',      'Hours between decay ticks'),
  ('food_per_mile',           '10',     'Food gained per mile allocated to Hunt Food (ALLOC-02)'),
  ('hunt_food_miles_cost',    '1',      'Miles cost per Hunt Food unit'),
  ('food_cap',                '100',    'Maximum food a village can hold'),
  ('food_hungry_threshold',   '20',     'Food level at or below which state = hungry (VLG-03)'),
  ('grace_period_hours',      '24',     'Hours before first decay tick after village creation (D2-25)'),

  -- Manual entry anti-cheat (MOV-08)
  ('manual_entry_daily_cap',  '10',     'Maximum miles credited per day from manual entry'),
  ('manual_max_speed_mph',    '15',     'Above this pace (mph) manual entry is rejected as impossible'),

  -- Activity multipliers (D2-16/D2-17)
  ('multiplier_walking',      '1.0',    'Walking activity mile multiplier'),
  ('multiplier_running',      '1.25',   'Running activity mile multiplier'),
  ('multiplier_cycling',      '1.25',   'Cycling activity mile multiplier'),
  ('multiplier_hiking',       '1.5',    'Hiking activity mile multiplier'),

  -- Activity type detection thresholds (Claude discretion — D2-16)
  ('pace_run_threshold_mpm',  '12',     'Pace in min/mile at or below which activity = running'),
  ('pace_cycle_threshold_mph','12',     'Speed in mph at or above which (sustained) activity = cycling'),
  ('elevation_hike_gain_m',   '50',     'Elevation gain in meters per km to trigger hiking classification'),

  -- Kalman filter tuning (MOV-02; Claude discretion)
  ('kalman_process_noise',    '0.00001','Kalman filter Q parameter (process noise)'),
  ('kalman_measurement_noise','0.0001', 'Kalman filter R parameter (measurement noise)')
ON CONFLICT (key) DO NOTHING;

-- -------------------------------------------------------------
-- 7. Supabase Storage: 'routes' bucket + RLS policies (MOV-03)
--    The bucket must be created via the Supabase dashboard or API
--    (storage.buckets INSERT is not available in migration SQL on hosted).
--    The RLS policies below are idempotent via DO $$ blocks.
-- -------------------------------------------------------------

-- Create the routes bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('routes', 'routes', false, 5242880, ARRAY['application/geo+json', 'application/json'])
ON CONFLICT (id) DO NOTHING;

-- Own-folder upload policy (T-02-ID)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'routes_upload_own'
  ) THEN
    CREATE POLICY routes_upload_own ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'routes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Own-folder read policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'routes_read_own'
  ) THEN
    CREATE POLICY routes_read_own ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'routes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
