-- Crée la table profiles et la synchronise automatiquement depuis auth.users
-- À coller dans Supabase Dashboard > SQL Editor et exécuter

-- ─── TABLE ────────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text,
  name      text    not null default '',
  initials  text    not null default '',
  color     text    not null default '#9FE1CB',
  "textColor" text  not null default '#085041'
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;

-- Tout utilisateur connecté peut lire les profils (pour la recherche par email)
create policy "profiles_select" on profiles
  for select using (auth.uid() is not null);

-- Un utilisateur ne peut insérer/modifier que son propre profil
create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on profiles
  for update using (auth.uid() = id);

-- ─── TRIGGER — sync à l'inscription et à la mise à jour du profil ─────────────
create or replace function sync_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, initials, color, "textColor")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'initials', ''),
    coalesce(new.raw_user_meta_data->>'color', '#9FE1CB'),
    coalesce(new.raw_user_meta_data->>'textColor', '#085041')
  )
  on conflict (id) do update set
    email       = excluded.email,
    name        = excluded.name,
    initials    = excluded.initials,
    color       = excluded.color,
    "textColor" = excluded."textColor";
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function sync_profile();

-- ─── BACKFILL — importe les utilisateurs déjà existants ───────────────────────
insert into public.profiles (id, email, name, initials, color, "textColor")
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', ''),
  coalesce(raw_user_meta_data->>'initials', ''),
  coalesce(raw_user_meta_data->>'color', '#9FE1CB'),
  coalesce(raw_user_meta_data->>'textColor', '#085041')
from auth.users
on conflict (id) do update set
  email       = excluded.email,
  name        = excluded.name,
  initials    = excluded.initials,
  color       = excluded.color,
  "textColor" = excluded."textColor";
