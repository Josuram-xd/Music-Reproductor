-- Per-user preferences (docs/ARCHITECTURE.md): floating mini-player on/off and
-- where it was left, and the neko radio (E9). One row per user, created on
-- first change; no row means the defaults.

create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  floating_player boolean not null default true,
  -- { "edge": "left" | "right", "y": 0..1 } (src/lib/settings/settings.ts)
  floating_pos jsonb check (floating_pos is null or jsonb_typeof(floating_pos) = 'object'),
  radio_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings: owner reads" on public.user_settings for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "user_settings: owner inserts" on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "user_settings: owner updates" on public.user_settings for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on public.user_settings from anon;
