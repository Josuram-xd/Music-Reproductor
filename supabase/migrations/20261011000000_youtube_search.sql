-- YouTube search: a shared results cache (saves the 10,000 units/day quota)
-- and per-user integrations (their own YouTube API key, encrypted).

-- ── yt_search_cache ────────────────────────────────────────────────────────
-- Shared by every user (results do not depend on who searched). Only the
-- server writes and reads it, with the secret key: RLS on, no policies.

create table public.yt_search_cache (
  query text primary key check (char_length(query) between 1 and 100),
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.yt_search_cache enable row level security;
revoke all on public.yt_search_cache from anon, authenticated;

-- ── user_integrations ──────────────────────────────────────────────────────
-- Secrets are encrypted by the server (AES-256-GCM, ENCRYPTION_KEY) before
-- they get here; the browser never sees them.

create table public.user_integrations (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('youtube', 'spotify')),
  client_id text,
  secret_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  -- Last characters of the key, to show "…abcd" in Ajustes without decrypting.
  secret_hint text check (secret_hint is null or char_length(secret_hint) <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, provider)
);

alter table public.user_integrations enable row level security;

create policy "user_integrations: owner reads" on public.user_integrations
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "user_integrations: owner inserts" on public.user_integrations
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "user_integrations: owner updates" on public.user_integrations
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "user_integrations: owner deletes" on public.user_integrations
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.user_integrations from anon;
