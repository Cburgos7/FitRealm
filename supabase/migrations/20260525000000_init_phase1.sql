-- Enable PostGIS for future location features (Phase 2+)
create extension if not exists postgis with schema extensions;

-- ============================================================
-- profiles table
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- ============================================================
-- villages table
-- ============================================================
create table public.villages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.villages enable row level security;

create policy villages_select_own on public.villages
  for select using (auth.uid() = owner_id);

create policy villages_insert_own on public.villages
  for insert with check (auth.uid() = owner_id);

create policy villages_update_own on public.villages
  for update using (auth.uid() = owner_id);

-- ============================================================
-- Auto-create profile on new user sign-up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
