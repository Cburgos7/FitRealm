-- Dev-only helper: decay only the caller's village (one tick).
--
-- Wraps the production decay_village_food() pattern but scoped to the
-- authenticated caller, so a dev test button can simulate a 6-hour pg_cron
-- tick without affecting other users' villages.
--
-- Use the same rules as the cron'd function:
--   * Respect grace_expires_at (skip if still in grace period)
--   * GREATEST(0, food - food_decay_per_tick) for the floor
--   * Recompute food_state from food + thresholds
--
-- Safety: SECURITY DEFINER + scoped to auth.uid() so a user can only
-- decay their own village. GRANT'd to authenticated only (not anon).

create or replace function public.dev_decay_my_village()
returns table (food numeric, food_state text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rate numeric;
  v_hungry_threshold numeric;
  v_new_food numeric;
  v_new_state text;
begin
  if v_user is null then
    raise exception 'dev_decay_my_village: must be authenticated';
  end if;

  select (value)::numeric into v_rate from game_config where key = 'food_decay_per_tick';
  if v_rate is null then v_rate := 2.5; end if;

  select (value)::numeric into v_hungry_threshold from game_config where key = 'food_hungry_threshold';
  if v_hungry_threshold is null then v_hungry_threshold := 20; end if;

  -- Update + return the new food/state. NOTE: we intentionally do NOT
  -- check grace_expires_at here, since the whole point of the dev button
  -- is to bypass grace and force a tick for testing.
  update villages
  set    food = greatest(0, food - v_rate),
         food_state = case
           when greatest(0, food - v_rate) = 0 then 'starving'
           when greatest(0, food - v_rate) <= v_hungry_threshold then 'hungry'
           else 'thriving'
         end
  where  owner_id = v_user
  returning villages.food, villages.food_state into v_new_food, v_new_state;

  return query select v_new_food, v_new_state;
end;
$$;

grant execute on function public.dev_decay_my_village() to authenticated;

comment on function public.dev_decay_my_village() is
  'DEV-ONLY: applies one food-decay tick to the caller''s village, bypassing '
  'grace period. Used by the dev menu in __DEV__ builds. Safe in production '
  'because it only affects the caller''s own row; leaving it in the prod DB '
  'is acceptable since RLS-equivalent scoping is enforced via auth.uid().';
