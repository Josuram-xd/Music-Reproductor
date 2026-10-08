-- Neko radio signals (docs/ARCHITECTURE.md): what was played and how,
-- what was searched, and which artists the user said "No me gusta" to.

-- ── play_events ────────────────────────────────────────────────────────────
-- One row per play of a track. Library tracks keep `track_id`; YouTube and
-- Spotify results outside the library keep `external_id`. Title and artist
-- are copied so stats and the radio still work if the track is deleted.

create table public.play_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track_id uuid,
  source text not null check (source in ('audio', 'youtube', 'spotify')),
  external_id text check (external_id is null or char_length(external_id) <= 200),
  title text not null check (char_length(title) between 1 and 300),
  artist text check (artist is null or char_length(artist) <= 300),
  started_at timestamptz not null default now(),
  listened_s numeric(10, 3) not null default 0 check (listened_s >= 0),
  completed boolean not null default false,
  skipped boolean not null default false,
  from_radio boolean not null default false,
  foreign key (track_id, owner_id) references public.tracks (id, owner_id)
    on delete set null (track_id)
);

create index play_events_owner_started_idx on public.play_events (owner_id, started_at desc);
create index play_events_track_idx on public.play_events (track_id);

-- ── search_history ─────────────────────────────────────────────────────────

create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 100),
  source text not null check (source in ('library', 'youtube', 'spotify')),
  created_at timestamptz not null default now()
);

create index search_history_owner_created_idx on public.search_history (owner_id, created_at desc);

-- ── radio_feedback ─────────────────────────────────────────────────────────
-- "No me gusta" lowers an artist's score (artist stored lowercase, trimmed).

create table public.radio_feedback (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  artist text not null check (char_length(artist) between 1 and 300),
  score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, artist)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- History is append-only for the user (insert, read, delete for "Borrar mi
-- historial"); feedback can also be updated.

alter table public.play_events enable row level security;
alter table public.search_history enable row level security;
alter table public.radio_feedback enable row level security;

create policy "play_events: owner reads" on public.play_events for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "play_events: owner inserts" on public.play_events for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "play_events: owner deletes" on public.play_events for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "search_history: owner reads" on public.search_history for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "search_history: owner inserts" on public.search_history for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "search_history: owner deletes" on public.search_history for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "radio_feedback: owner reads" on public.radio_feedback for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "radio_feedback: owner inserts" on public.radio_feedback for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "radio_feedback: owner updates" on public.radio_feedback for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "radio_feedback: owner deletes" on public.radio_feedback for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.play_events, public.search_history, public.radio_feedback from anon;
