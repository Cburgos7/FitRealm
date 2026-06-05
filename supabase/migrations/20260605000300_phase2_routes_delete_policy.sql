-- =============================================================
-- Phase 2: Core Movement Loop — Storage 'routes' DELETE/UPDATE RLS (WR-06)
-- =============================================================
-- Migration: 20260605000300_phase2_routes_delete_policy.sql
--
-- Fixes WR-06 (policy half): the original phase2_game migration created
-- own-folder INSERT (routes_upload_own) and SELECT (routes_read_own) policies
-- for storage.objects in the 'routes' bucket, but NO UPDATE or DELETE policy.
-- Without a DELETE policy:
--   * Failed/abandoned route uploads accumulate with no cleanup path.
--   * Users cannot delete their own route data (a GDPR/data-rights gap).
-- Without an UPDATE policy:
--   * Re-uploading a route to the same object path (orphan recovery / re-bank)
--     cannot overwrite — only a fresh INSERT to a new path works.
--
-- This migration adds own-folder UPDATE and DELETE policies, scoped exactly
-- like the existing INSERT/SELECT policies: the first path segment of the
-- object name must equal the caller's auth.uid(). Each is wrapped in an
-- idempotent DO $$ ... pg_policies existence check so re-running is safe.
--
-- NOTE: bucket creation itself (storage.buckets INSERT) remains a deferred
-- deploy gate verified on the Supabase dashboard — only the SQL policies are
-- added here. (See the device/deploy punch-list.)
-- =============================================================

-- Own-folder UPDATE policy (overwrite a re-uploaded route in your own folder)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'routes_update_own'
  ) THEN
    CREATE POLICY routes_update_own ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'routes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'routes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Own-folder DELETE policy (delete your own route data — cleanup + data rights)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'routes_delete_own'
  ) THEN
    CREATE POLICY routes_delete_own ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'routes'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
